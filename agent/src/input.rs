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
    #[serde(rename = "down")]
    Down, // left button press-and-hold (drag start)
    #[serde(rename = "up")]
    Up, // left button release (drag end)
    #[serde(rename = "key")]
    Key { k: String },
}

fn runtime() -> String {
    std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/run/user/1000".into())
}
fn wl() -> String {
    std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".into())
}
fn ydotool_socket() -> String {
    std::env::var("YDOTOOL_SOCKET").unwrap_or_else(|_| "/run/ydotool.sock".into())
}

/// ydotool click codes: low bits pick the button (0 left, 1 right), 0x40 = press,
/// 0x80 = release; 0xC0/0xC1 = a full click.
async fn ydotool(args: &[&str]) {
    let _ = Command::new("ydotool")
        .args(args)
        .env("YDOTOOL_SOCKET", ydotool_socket())
        .status()
        .await;
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

/// Prefer ydotool (uinput) when its daemon socket is present — one device for
/// move/click/hold, so drag-select works. Otherwise fall back to wlrctl, which
/// needs no root but can't hold a button (so drag is unavailable).
fn have_ydotool() -> bool {
    std::path::Path::new(&ydotool_socket()).exists()
}

async fn wlrctl(args: &[&str]) {
    let _ = Command::new("wlrctl")
        .args(args)
        .env("XDG_RUNTIME_DIR", runtime())
        .env("WAYLAND_DISPLAY", wl())
        .status()
        .await;
}

async fn inject(ev: Ev) {
    let yd = have_ydotool();
    match ev {
        Ev::Move { dx, dy } => {
            if yd {
                ydotool(&["mousemove", "-x", &dx.to_string(), "-y", &dy.to_string()]).await;
            } else {
                wlrctl(&["pointer", "move", &dx.to_string(), &dy.to_string()]).await;
            }
        }
        Ev::Click { b } => {
            let right = b == "right";
            if yd {
                ydotool(&["click", if right { "0xC1" } else { "0xC0" }]).await;
            } else {
                wlrctl(&["pointer", "click", if right { "right" } else { "left" }]).await;
            }
        }
        Ev::Down if yd => ydotool(&["click", "0x40"]).await, // left press (drag start)
        Ev::Up if yd => ydotool(&["click", "0x80"]).await,   // left release (drag end)
        Ev::Down | Ev::Up => {} // no button-hold without ydotool
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
