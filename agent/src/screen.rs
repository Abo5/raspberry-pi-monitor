//! Real screen streaming over `WS /screen`. Captures the Wayland desktop with
//! `grim` (half-resolution PPM), encodes JPEG in-process, and pushes one binary
//! frame per capture. grim on Debian has JPEG disabled, so we encode ourselves.
//!
//! grim's speed (~0.4 s/frame via wlr-screencopy) caps the rate; that's fine for
//! a remote-control view. Input injection is a separate channel.

use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::extract::ws::{Message, WebSocket};
use axum::http::header;
use axum::response::Response;
use jpeg_encoder::{ColorType, Encoder};
use tokio::process::Command;

/// `GET /screen.mjpeg` — a motion-JPEG (`multipart/x-mixed-replace`) HTTP stream.
/// A WebView `<img>` decodes this natively (no per-frame work on the JS side),
/// which is far smoother and lighter than shipping frames over a WebSocket.
pub fn mjpeg_response() -> Response {
    let stream = futures_util::stream::unfold((), |()| async {
        let chunk = match capture_jpeg().await {
            Some(jpeg) => {
                let mut c = format!(
                    "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: {}\r\n\r\n",
                    jpeg.len()
                )
                .into_bytes();
                c.extend_from_slice(&jpeg);
                c.extend_from_slice(b"\r\n");
                Bytes::from(c)
            }
            None => {
                tokio::time::sleep(Duration::from_millis(300)).await;
                Bytes::new()
            }
        };
        Some((Ok::<Bytes, std::io::Error>(chunk), ()))
    });
    Response::builder()
        .header(header::CONTENT_TYPE, "multipart/x-mixed-replace; boundary=frame")
        .header(header::CACHE_CONTROL, "no-cache, no-store, must-revalidate")
        .body(Body::from_stream(stream))
        .expect("valid mjpeg response")
}

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
        // Tiny floor between frames (grim capture + encode already pace us to a
        // sane rate); mostly here to notice a client close promptly.
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(8)) => {}
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
    // Capture native resolution (Full HD) WITH the cursor (`-c`), so the user
    // sees the Pi's real mouse pointer in the stream.
    let out = Command::new("grim")
        .args(["-c", "-t", "ppm", "-"])
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
