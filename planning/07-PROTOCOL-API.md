# 07 — Protocol & API

Two interfaces: a simple **local HTTP/WS API** (Track A / MVP, easy to build and
test) and the **binary channel protocol** (both tracks, the long-term contract).

---

## 1. Local dev API (Track A / MVP)

TLS. Auth: `Authorization: Bearer <token>` where the token is derived at pairing.
JSON bodies. This is the fastest thing to stand up and lets the client talk to a
real Pi immediately.

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/health` | Liveness + Agent version | `{ version, uptime_s }` |
| GET | `/snapshot` | Latest values for all series | `Snapshot` (below) |
| GET | `/series?key=&from=&to=&res=` | History for one series | `{ key, rollup, samples:[{t,v}], coverage:[{from,to}] }` |
| GET | `/actions` | The allow-list | `[Action]` |
| POST | `/actions/:id/run` | Run an Action | `{ run_id }` then progress on WS |
| GET | `/agent` | Identity/host facts | `{ name, hostname, model, os, agent_version }` |
| WS | `/telemetry` | Live snapshots | stream of `Snapshot` |
| WS | `/shell` | Interactive PTY | binary duplex (see §4) |

### Snapshot
```json
{
  "producedAt": 1730000000000,
  "staleAfter": 15000,
  "veryStaleAfter": 60000,
  "values": { "cpu.temp_c": 54.2, "cpu.util_pct": 12.4, "...": 0 },
  "coverage": { "cpu.temp_c": [{ "from": 1730000000000, "to": 1730000000000 }] }
}
```

### Action
```json
{
  "id": "restart-pihole", "category": "Services", "name": "Restart Pi-hole",
  "command": "systemctl restart pihole-FTL", "expectedDurationS": 4,
  "destructive": false, "dropsTunnel": false, "needsConfirmation": false,
  "lastRun": { "at": 1730000000000, "exitCode": 0, "durationS": 1.2 }
}
```

## 2. Binary channel protocol (both tracks)

Framed, length-prefixed **CBOR** messages multiplexed into logical **channels**.
The same message layer runs over Track A (WS/TLS) or Track B (Noise-over-
DataChannel).

### 2.1 Frame
```
| u32 length | u8 channel | u8 type | CBOR payload |
```

### 2.2 Channels
| Channel | Purpose |
|---|---|
| `control` | Handshake milestones, subscribe/unsubscribe, action invoke, config. |
| `telemetry` | Snapshot stream + history + backfill. |
| `shell` | PTY bytes + resize + lifecycle. |
| `actions` | Action progress + results. |
| `screen` | (Remote Desktop phase) encoded video. |
| `input` | (Remote Desktop phase) pointer/keyboard injection. |
| `files` | Reserved; opening it is a defined, tested failure in v1. |

### 2.3 Representative messages
```
control  → HELLO            { protocol_version, client_info }
control  ← MILESTONE        { stage: "transport"|"handshake_sent"|"handshake_done"|"channel_open" }
telemetry→ SUBSCRIBE        { interval_s }
telemetry← SNAPSHOT         { ...Snapshot }
telemetry→ HISTORY          { key, from, to, res }
telemetry← HISTORY_RESULT   { key, rollup, samples, coverage }
shell    → OPEN             { cols, rows }
shell    ↔ DATA             (raw bytes)
shell    → RESIZE           { cols, rows }
shell    ← LIFECYCLE        { event: "opened"|"reattached"|"ended", session_id }
actions  → RUN              { action_id }
actions  ← PROGRESS         { run_id, phase }
actions  ← RESULT           { run_id, exit_code, duration_s, stderr_tail }
```

## 3. Error model

Every error carries a stable, copyable code so it can be pasted into a bug report
and understood. Codes are grouped:

| Range | Class | Examples |
|---|---|---|
| `E-01xx` | Pairing/handshake | `E-0101` QR expired, `E-0102` handshake rejected |
| `E-02xx` | Auth/trust | `E-0201` untrusted device, `E-0203` fingerprint mismatch |
| `E-03xx` | Protocol | `E-0301` bad frame, `E-0302` version mismatch |
| `E-04xx` | Channel | `E-0412` channel error, `E-0420` files channel not supported |
| `E-05xx` | Shell | `E-0530` shell disconnected |
| `E-06xx` | Action | `E-0601` action failed, `E-0602` action timeout |
| `E-07xx` | Transport | `E-0701` relay unreachable, `E-0702` candidate gathering failed |

The client shows the code verbatim; automatic retry only for transient transport
errors (with a visible backoff countdown), never for protocol errors.

## 4. Shell wire behaviour

- Duplex raw bytes on the `shell` channel; the client renders them in a terminal
  emulator (xterm-class) and sends keystrokes back.
- `RESIZE` triggers a PTY `SIGWINCH`; the Agent replies with the new `cols×rows`.
- Multi-line paste is guarded on the **client** (confirmation sheet) — the Agent
  just receives bytes.
- On reconnect within the grace period, `OPEN` with the prior `session_id`
  reattaches the same PTY; otherwise a new session is offered.

## 5. Versioning

- `protocol_version` is exchanged in `HELLO`. Mismatch → `E-0302` with a
  "update the Agent/app" message. The protocol is additive where possible;
  breaking changes bump the major version.
