//! Real screen streaming over `WS /screen`. Captures the Wayland desktop with
//! `grim` (half-resolution PPM), encodes JPEG in-process, and pushes one binary
//! frame per capture. grim on Debian has JPEG disabled, so we encode ourselves.
//!
//! grim's speed (~0.4 s/frame via wlr-screencopy) caps the rate; that's fine for
//! a remote-control view. Input injection is a separate channel.

use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use jpeg_encoder::{ColorType, Encoder};
use tokio::process::Command;

pub async fn handle_screen(mut socket: WebSocket) {
    loop {
        match capture_jpeg().await {
            Some(jpeg) => {
                if socket.send(Message::Binary(jpeg)).await.is_err() {
                    break;
                }
            }
            None => {
                let _ = socket
                    .send(Message::Text(
                        "{\"screen\":\"capture-failed\"}".to_string(),
                    ))
                    .await;
                tokio::time::sleep(Duration::from_millis(600)).await;
            }
        }
        // Small floor between frames; also lets a client close break promptly.
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(80)) => {}
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Close(_))) | None => break,
                _ => {}
            }
        }
    }
}

async fn capture_jpeg() -> Option<Vec<u8>> {
    let runtime = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/run/user/1000".into());
    let wl = std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".into());
    // Capture at native resolution (Full HD on this Pi) for a sharp picture.
    let out = Command::new("grim")
        .args(["-t", "ppm", "-"])
        .env("XDG_RUNTIME_DIR", runtime)
        .env("WAYLAND_DISPLAY", wl)
        .output()
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let (w, h, rgb) = parse_ppm(&out.stdout)?;
    let mut buf = Vec::with_capacity(256 * 1024);
    let enc = Encoder::new(&mut buf, 72);
    enc.encode(rgb, w as u16, h as u16, ColorType::Rgb).ok()?;
    Some(buf)
}

/// Parse a binary PPM (`P6`) header → (width, height, pixel bytes).
fn parse_ppm(d: &[u8]) -> Option<(usize, usize, &[u8])> {
    if d.len() < 2 || &d[0..2] != b"P6" {
        return None;
    }
    let mut i = 2usize;
    let mut nums = [0usize; 3]; // width, height, maxval
    for slot in nums.iter_mut() {
        while i < d.len() && d[i].is_ascii_whitespace() {
            i += 1;
        }
        let start = i;
        while i < d.len() && d[i].is_ascii_digit() {
            i += 1;
        }
        if start == i {
            return None;
        }
        *slot = std::str::from_utf8(&d[start..i]).ok()?.parse().ok()?;
    }
    i += 1; // single whitespace separating the header from the pixels
    let (w, h) = (nums[0], nums[1]);
    let need = w.checked_mul(h)?.checked_mul(3)?;
    if w == 0 || h == 0 || d.len() < i + need {
        return None;
    }
    Some((w, h, &d[i..i + need]))
}
