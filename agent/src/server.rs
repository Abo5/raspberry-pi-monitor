//! Phase-1 dev API (see planning/07-PROTOCOL-API.md §1). HTTP + WebSocket.
//! NOTE: TLS is added in the bring-up step; this scaffold serves plain HTTP so
//! it compiles and runs anywhere for local testing. Bearer-token auth is applied
//! to every route.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{header, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::broadcast;

use crate::config::Config;
use crate::shell;
use crate::store::{now_ms, Store};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub store: Store,
    pub live: broadcast::Sender<String>, // JSON snapshots fanned out to WS subscribers
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/agent", get(agent_facts))
        .route("/snapshot", get(snapshot))
        .route("/series", get(series))
        .route("/actions", get(actions))
        .route("/actions/:id/run", post(run_action))
        .route("/telemetry", get(ws_telemetry))
        .route("/shell", get(ws_shell))
        .layer(middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state)
}

/// Bearer-token gate on every request (skips the WS handshake's own auth needs;
/// the token is supplied as `?token=` for WS or the Authorization header for HTTP).
async fn auth(State(state): State<AppState>, req: Request<axum::body::Body>, next: Next) -> Response {
    let want = &state.cfg.token;
    let header_ok = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .map(|h| h.strip_prefix("Bearer ").unwrap_or("") == want)
        .unwrap_or(false);
    let query_ok = req
        .uri()
        .query()
        .map(|q| q.split('&').any(|kv| kv == format!("token={want}")))
        .unwrap_or(false);
    if header_ok || query_ok {
        next.run(req).await
    } else {
        (StatusCode::UNAUTHORIZED, "unauthorized").into_response()
    }
}

async fn health(State(s): State<AppState>) -> impl IntoResponse {
    Json(json!({ "version": env!("CARGO_PKG_VERSION"), "name": s.cfg.name }))
}

async fn agent_facts(State(s): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "name": s.cfg.name,
        "hostname": s.cfg.name,
        "model": read_model(),
        "os": read_os(),
        "agent_version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn snapshot(State(s): State<AppState>) -> impl IntoResponse {
    match s.store.latest() {
        Some(snap) => Json(snap).into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, "no sample yet").into_response(),
    }
}

#[derive(Deserialize)]
struct SeriesQuery {
    key: String,
    from: Option<i64>,
    to: Option<i64>,
}

async fn series(State(s): State<AppState>, Query(q): Query<SeriesQuery>) -> impl IntoResponse {
    let to = q.to.unwrap_or_else(now_ms);
    let from = q.from.unwrap_or(to - 3_600_000);
    let samples = s.store.series(&q.key, from, to);
    Json(json!({ "key": q.key, "rollup": "raw", "samples": samples, "coverage": [] }))
}

async fn actions() -> impl IntoResponse {
    // Phase 2 loads these from agent.toml and wires execution.
    Json(json!([]))
}

async fn run_action() -> impl IntoResponse {
    (StatusCode::NOT_IMPLEMENTED, "actions land in Phase 2")
}

async fn ws_telemetry(State(s): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| telemetry_socket(socket, s))
}

async fn telemetry_socket(mut socket: WebSocket, s: AppState) {
    // Send the latest immediately, then every broadcast tick.
    if let Some(snap) = s.store.latest() {
        if let Ok(txt) = serde_json::to_string(&snap) {
            let _ = socket.send(Message::Text(txt)).await;
        }
    }
    let mut rx = s.live.subscribe();
    loop {
        tokio::select! {
            msg = rx.recv() => match msg {
                Ok(txt) => { if socket.send(Message::Text(txt)).await.is_err() { break; } }
                Err(_) => {} // lagged; keep going
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Close(_))) | None => break,
                _ => {}
            }
        }
    }
}

async fn ws_shell(State(_s): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(shell::handle_shell)
}

fn read_model() -> String {
    std::fs::read_to_string("/proc/device-tree/model")
        .map(|s| s.trim_end_matches('\0').trim().to_string())
        .unwrap_or_else(|_| "Raspberry Pi".into())
}

fn read_os() -> String {
    std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|t| {
            t.lines()
                .find_map(|l| l.strip_prefix("PRETTY_NAME=").map(|v| v.trim_matches('"').to_string()))
        })
        .unwrap_or_else(|| "Linux".into())
}

/// Spawn the sampler → store → live-broadcast loop.
pub fn spawn_sampler(state: AppState) {
    tokio::spawn(async move {
        let mut sampler = crate::metrics::Sampler::new();
        let interval = state.cfg.interval_s.max(1);
        loop {
            let values = sampler.sample();
            let snap = crate::store::Snapshot {
                produced_at: now_ms(),
                stale_after: interval * 3000,
                very_stale_after: interval * 12000,
                values,
            };
            state.store.push(snap.clone());
            if let Ok(txt) = serde_json::to_string(&snap) {
                let _ = state.live.send(txt);
            }
            tokio::time::sleep(Duration::from_secs(interval)).await;
        }
    });
}
