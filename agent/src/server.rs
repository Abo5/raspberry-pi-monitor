//! HTTP + WebSocket API (planning/07-PROTOCOL-API.md §1). Phase 2 adds real
//! history (/series), actions (/actions + run), rules CRUD, alerts, backtest.
//! Bearer-token auth on every route. TLS is layered in at bring-up; this serves
//! plain HTTP for the LAN MVP.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::broadcast;

use crate::config::Config;
use crate::rules::{backtest, RuleState};
use crate::shell;
use crate::store::{now_ms, Rule, Store};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub store: Store,
    pub live: broadcast::Sender<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/agent", get(agent_facts))
        .route("/snapshot", get(snapshot))
        .route("/series", get(series))
        .route("/actions", get(actions))
        .route("/actions/:id/run", post(run_action))
        .route("/rules", get(list_rules).put(put_rule).post(put_rule))
        .route("/rules/:id", delete(delete_rule))
        .route("/alerts", get(list_alerts))
        .route("/backtest", post(backtest_route))
        .route("/telemetry", get(ws_telemetry))
        .route("/shell", get(ws_shell))
        .route("/screen", get(ws_screen))
        .route("/input", get(ws_input))
        .layer(middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state)
}

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
        "name": s.cfg.name, "hostname": s.cfg.name,
        "model": read_model(), "os": read_os(),
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
    points: Option<i64>,
}

async fn series(State(s): State<AppState>, Query(q): Query<SeriesQuery>) -> impl IntoResponse {
    let to = q.to.unwrap_or_else(now_ms);
    let from = q.from.unwrap_or(to - 3_600_000);
    let (rollup, samples) = s.store.series(&q.key, from, to, q.points.unwrap_or(120));
    Json(json!({ "key": q.key, "rollup": rollup, "samples": samples, "coverage": [] }))
}

async fn actions(State(s): State<AppState>) -> impl IntoResponse {
    let list: Vec<_> = s
        .cfg
        .actions
        .iter()
        .map(|a| {
            json!({
                "id": a.id, "category": a.category, "name": a.name, "command": a.command,
                "expectedDurationS": a.expected_duration_s,
                "destructive": a.destructive, "dropsTunnel": a.drops_tunnel,
                "needsConfirmation": a.destructive,
            })
        })
        .collect();
    Json(list)
}

async fn run_action(State(s): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    match s.cfg.actions.iter().find(|a| a.id == id) {
        Some(def) => {
            let res = crate::actions::run(def, Instant::now()).await;
            Json(res).into_response()
        }
        None => (StatusCode::NOT_FOUND, "no such action in the allow-list").into_response(),
    }
}

async fn list_rules(State(s): State<AppState>) -> impl IntoResponse {
    Json(s.store.rules())
}

async fn put_rule(State(s): State<AppState>, Json(rule): Json<Rule>) -> impl IntoResponse {
    s.store.upsert_rule(&rule);
    Json(json!({ "ok": true, "id": rule.id }))
}

async fn delete_rule(State(s): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    s.store.delete_rule(&id);
    Json(json!({ "ok": true }))
}

async fn list_alerts(State(s): State<AppState>) -> impl IntoResponse {
    Json(s.store.alerts(200))
}

#[derive(Deserialize)]
struct BacktestBody {
    key: String,
    op: String,
    threshold: f64,
    #[serde(rename = "dwellS")]
    dwell_s: f64,
    #[serde(rename = "rangeMs")]
    range_ms: i64,
}

async fn backtest_route(State(s): State<AppState>, Json(b): Json<BacktestBody>) -> impl IntoResponse {
    let to = now_ms();
    let (_rollup, samples) = s.store.series(&b.key, to - b.range_ms, to, 500);
    let spans = backtest(&samples, &b.op, b.threshold, b.dwell_s, to);
    Json(json!({
        "count": spans.len(),
        "spans": spans.iter().map(|(f, t)| json!({ "from": f, "to": t })).collect::<Vec<_>>(),
    }))
}

async fn ws_telemetry(State(s): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| telemetry_socket(socket, s))
}

async fn telemetry_socket(mut socket: WebSocket, s: AppState) {
    if let Some(snap) = s.store.latest() {
        if let Ok(txt) = serde_json::to_string(&snap) {
            let _ = socket.send(Message::Text(txt)).await;
        }
    }
    let mut rx = s.live.subscribe();
    loop {
        tokio::select! {
            msg = rx.recv() => if let Ok(txt) = msg { if socket.send(Message::Text(txt)).await.is_err() { break; } },
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

async fn ws_screen(State(_s): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(crate::screen::handle_screen)
}

async fn ws_input(State(_s): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(crate::input::handle_input)
}

fn read_model() -> String {
    std::fs::read_to_string("/proc/device-tree/model")
        .map(|s| s.trim_end_matches('\0').trim().to_string())
        .unwrap_or_else(|_| "Raspberry Pi".into())
}
fn read_os() -> String {
    std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|t| t.lines().find_map(|l| l.strip_prefix("PRETTY_NAME=").map(|v| v.trim_matches('"').to_string())))
        .unwrap_or_else(|| "Linux".into())
}

/// Sampler → store → rules eval → live broadcast.
pub fn spawn_sampler(state: AppState) {
    tokio::spawn(async move {
        let mut sampler = crate::metrics::Sampler::new();
        let mut rules = RuleState::new();
        let interval = state.cfg.interval_s.max(1);
        loop {
            let values = sampler.sample();
            let now = now_ms();
            let snap = crate::store::Snapshot {
                produced_at: now,
                stale_after: interval * 3000,
                very_stale_after: interval * 12000,
                values: values.clone(),
            };
            state.store.push(snap.clone());
            rules.evaluate(&state.store, &values, now);
            if let Ok(txt) = serde_json::to_string(&snap) {
                let _ = state.live.send(txt);
            }
            tokio::time::sleep(Duration::from_secs(interval)).await;
        }
    });
}
