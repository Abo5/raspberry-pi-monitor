//! Raspberry App Agent.
//! Samples the Pi's real metrics and serves them (telemetry, history, an
//! interactive shell, allow-listed actions, and alert rules) over a local
//! HTTP/WebSocket API the iOS client connects to. See planning/.

mod actions;
mod config;
mod input;
mod screen;
mod metrics;
mod rules;
mod server;
mod shell;
mod store;

use std::sync::Arc;

use tokio::sync::broadcast;

use config::Config;
use server::{router, spawn_sampler, AppState};
use store::Store;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "raspberry_agent=info".into()),
        )
        .init();

    let cfg = Arc::new(Config::load());
    let store = Store::open(&cfg.db_path, cfg.retention_days)?;
    tracing::info!("store: {} (retention {} days)", cfg.db_path, cfg.retention_days);
    let (live, _) = broadcast::channel::<String>(64);

    let state = AppState { cfg: cfg.clone(), store, live };
    spawn_sampler(state.clone());

    print_pairing(&cfg);

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    tracing::info!("Agent listening on {}", cfg.bind_addr);
    axum::serve(listener, router(state)).await?;
    Ok(())
}

/// Print the connection details + a QR the client scans. Phase 3 replaces the
/// bearer token with the real key handshake + fingerprint ceremony.
fn print_pairing(cfg: &Config) {
    use qrcode::{render::unicode, QrCode};

    let ip = local_ip().unwrap_or_else(|| "<pi-ip>".into());
    let port = cfg.bind_addr.rsplit(':').next().unwrap_or("8443");
    let payload = serde_json::json!({ "ip": ip, "port": port, "token": cfg.token }).to_string();

    println!("\n  Raspberry App — Agent ready as \"{}\"", cfg.name);
    println!("  Scan this in the app  (I already have the Agent running → scan):\n");
    if let Ok(code) = QrCode::new(payload.as_bytes()) {
        let img = code
            .render::<unicode::Dense1x2>()
            .dark_color(unicode::Dense1x2::Light)
            .light_color(unicode::Dense1x2::Dark)
            .build();
        println!("{img}");
    }
    println!("  Or enter by hand:  {ip}:{port}   token: {}\n", cfg.token);
}

fn local_ip() -> Option<String> {
    // Best-effort: the address of the default route interface. Falls back to None.
    let out = std::process::Command::new("hostname").arg("-I").output().ok()?;
    let s = String::from_utf8_lossy(&out.stdout);
    s.split_whitespace().next().map(|x| x.to_string())
}
