// relay — a zero-knowledge connection broker for the Raspberry App.
//
// It runs on a public VPS and pairs each phone with its own Pi. It is a DUMB
// PIPE: it routes by a public routing id (rid) and copies bytes between the one
// agent and the one app that share that rid. It never sees plaintext — the app
// and the agent encrypt everything end-to-end (NaCl secretbox) with a key the
// relay does not have. Multi-tenant: many rids, each isolated to its own pair.
//
//	Pi agent :  GET ws://<vps>:8787/register?rid=<rid>
//	Phone app:  GET ws://<vps>:8787/connect?rid=<rid>
//
// Control messages the relay may send to the app (text frames, JSON):
//	{"relay":"paired"}     an agent is present; the tunnel is open
//	{"relay":"no-agent"}   no Pi is online for this rid
//
// Everything else is binary and passed through verbatim.
package main

import (
	"flag"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,
	CheckOrigin:     func(*http.Request) bool { return true },
}

// conn wraps a websocket with a write mutex (gorilla allows one writer at a time).
type conn struct {
	ws *websocket.Conn
	mu sync.Mutex
}

func (c *conn) write(mt int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.ws.WriteMessage(mt, data)
}

type hub struct {
	mu     sync.Mutex
	agents map[string]*conn // rid -> agent connection
}

func newHub() *hub { return &hub{agents: make(map[string]*conn)} }

func (h *hub) setAgent(rid string, c *conn) (old *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	old = h.agents[rid]
	h.agents[rid] = c
	return old
}

func (h *hub) clearAgent(rid string, c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.agents[rid] == c {
		delete(h.agents, rid)
	}
}

func (h *hub) getAgent(rid string) *conn {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.agents[rid]
}

func validRid(rid string) bool {
	if len(rid) < 8 || len(rid) > 128 {
		return false
	}
	for _, r := range rid {
		ok := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_'
		if !ok {
			return false
		}
	}
	return true
}

// pump copies messages from src to dst until either side errors. It returns so
// the caller can tear the pair down.
func pump(src, dst *conn) {
	for {
		src.ws.SetReadDeadline(time.Now().Add(90 * time.Second))
		mt, data, err := src.ws.ReadMessage()
		if err != nil {
			return
		}
		if mt == websocket.PingMessage || mt == websocket.PongMessage {
			continue
		}
		if err := dst.write(mt, data); err != nil {
			return
		}
	}
}

func (h *hub) handleRegister(w http.ResponseWriter, r *http.Request) {
	rid := r.URL.Query().Get("rid")
	if !validRid(rid) {
		http.Error(w, "bad rid", http.StatusBadRequest)
		return
	}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &conn{ws: ws}
	if old := h.setAgent(rid, c); old != nil {
		old.ws.Close() // a fresh agent for this rid replaces the stale one
	}
	log.Printf("agent registered rid=%s… from %s", short(rid), r.RemoteAddr)

	// Keepalive + drain: the agent parks here until an app pairs. We must keep
	// reading so control/pong frames flow and dead sockets are detected.
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()
		for range t.C {
			if c.write(websocket.PingMessage, nil) != nil {
				return
			}
		}
	}()
	for {
		ws.SetReadDeadline(time.Now().Add(90 * time.Second))
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
		// While unpaired the agent shouldn't send data; ignore stray frames.
	}
	h.clearAgent(rid, c)
	ws.Close()
	log.Printf("agent gone rid=%s…", short(rid))
}

func (h *hub) handleConnect(w http.ResponseWriter, r *http.Request) {
	rid := r.URL.Query().Get("rid")
	if !validRid(rid) {
		http.Error(w, "bad rid", http.StatusBadRequest)
		return
	}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	app := &conn{ws: ws}
	agent := h.getAgent(rid)
	if agent == nil {
		app.write(websocket.TextMessage, []byte(`{"relay":"no-agent"}`))
		ws.Close()
		return
	}
	app.write(websocket.TextMessage, []byte(`{"relay":"paired"}`))
	log.Printf("app paired rid=%s… from %s", short(rid), r.RemoteAddr)

	// Bidirectional dumb pipe. When either side closes, both do.
	done := make(chan struct{}, 2)
	go func() { pump(app, agent); done <- struct{}{} }()
	go func() { pump(agent, app); done <- struct{}{} }()
	<-done
	ws.Close()
	log.Printf("app unpaired rid=%s…", short(rid))
}

func short(rid string) string {
	if len(rid) > 8 {
		return rid[:8]
	}
	return rid
}

func main() {
	addr := flag.String("addr", ":8787", "listen address")
	flag.Parse()

	h := newHub()
	mux := http.NewServeMux()
	mux.HandleFunc("/register", h.handleRegister)
	mux.HandleFunc("/connect", h.handleConnect)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })

	log.Printf("relay listening on %s", *addr)
	srv := &http.Server{Addr: *addr, Handler: mux}
	log.Fatal(srv.ListenAndServe())
}
