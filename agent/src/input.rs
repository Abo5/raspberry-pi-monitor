//! Remote input injection over `WS /input`. The app sends JSON events; we drive
//! the Pi's real pointer/keyboard so you control the machine's OWN cursor.
//!
//!   {"t":"m","dx":..,"dy":..}         relative pointer move
//!   {"t":"click","b":"left"|"right"}  mouse click
//!   {"t":"key","k":"a" | "Return" | "Ctrl+c" | "F5" | "Left"}
//!
//! Pointer uses `wlrctl` (wlroots virtual-pointer, works under labwc as the
//! session user — no root/uinput); keys use `wtype`. If a tool is missing the
//! event is a no-op, never a crash.
use axum::extract::ws::{Message, WebSocket};
use serde::Deserialize;
use tokio::process::Command;

#[derive(Deserialize)]
#[serde(tag = "t")]
enum Ev {
    #[serde(rename = "m")]
    Move { dx: i32, dy: i32 },
    #[serde(rename = "click")]
    Click { b: String },
    #[serde(rename = "key")]
    Key { k: String },
}

fn runtime() -> String {
    std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/run/user/1000".into())
}
fn wl() -> String {
    std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".into())
}

pub async fn handle_input(mut socket: WebSocket) {
    while let Some(Ok(msg)) = socket.recv().await {
        match msg {
            Message::Text(txt) => {
                if let Ok(ev) = serde_json::from_str::<Ev>(&txt) {
                    tokio::spawn(inject(ev));
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}

async fn inject(ev: Ev) {
    match ev {
        Ev::Move { dx, dy } => {
            let _ = Command::new("wlrctl")
                .args(["pointer", "move", &dx.to_string(), &dy.to_string()])
                .env("XDG_RUNTIME_DIR", runtime())
                .env("WAYLAND_DISPLAY", wl())
                .status()
                .await;
        }
        Ev::Click { b } => {
            let button = if b == "right" { "right" } else { "left" };
            let _ = Command::new("wlrctl")
                .args(["pointer", "click", button])
                .env("XDG_RUNTIME_DIR", runtime())
                .env("WAYLAND_DISPLAY", wl())
                .status()
                .await;
        }
        Ev::Key { k } => inject_key(&k).await,
    }
}

/// `Ctrl+c`, `Return`, `F5`, `a` … → wtype. Modifiers before the final key.
async fn inject_key(k: &str) {
    let parts: Vec<&str> = k.split('+').collect();
    let (mods, key) = parts.split_at(parts.len().saturating_sub(1));
    let key = key.first().copied().unwrap_or("");
    if key.is_empty() {
        return;
    }
    let mod_flag = |m: &str| match m.to_ascii_lowercase().as_str() {
        "ctrl" => Some("ctrl"),
        "alt" => Some("alt"),
        "shift" => Some("shift"),
        "super" => Some("logo"),
        _ => None,
    };

    let mut args: Vec<String> = Vec::new();
    for m in mods {
        if let Some(f) = mod_flag(m) {
            args.push("-M".into());
            args.push(f.into());
        }
    }
    // A single printable char types directly; named keys use -k <keysym>.
    if key.chars().count() == 1 && mods.is_empty() {
        args.push("--".into());
        args.push(key.into());
    } else {
        args.push("-k".into());
        args.push(key.into());
    }
    for m in mods {
        if let Some(f) = mod_flag(m) {
            args.push("-m".into());
            args.push(f.into());
        }
    }
    let _ = Command::new("wtype")
        .args(&args)
        .env("XDG_RUNTIME_DIR", runtime())
        .env("WAYLAND_DISPLAY", std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".into()))
        .status()
        .await;
}
