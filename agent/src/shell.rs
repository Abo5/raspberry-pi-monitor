//! Interactive PTY over the `shell` WebSocket (Phase 1).
//!
//! Wire format (simple, upgraded to the binary channel protocol later):
//!   - text frame `{"resize":{"cols":C,"rows":R}}`  → resize the PTY
//!   - binary frame                                  → written to the PTY stdin
//!   - PTY output                                    → sent back as binary frames
//!
//! Phase 2 spawns the shell as a transient systemd unit *outside* the Agent
//! sandbox (see planning/05-AGENT §4). Here we spawn bash directly for the MVP.

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Deserialize;
use std::io::{Read, Write};

#[derive(Deserialize)]
struct ClientMsg {
    resize: Option<Resize>,
}

#[derive(Deserialize)]
struct Resize {
    cols: u16,
    rows: u16,
}

pub async fn handle_shell(socket: WebSocket) {
    if let Err(e) = run(socket).await {
        tracing::warn!("shell session ended: {e}");
    }
}

async fn run(socket: WebSocket) -> anyhow::Result<()> {
    let (mut ws_tx, mut ws_rx) = socket.split();

    let pty = native_pty_system();
    let pair = pty.openpty(PtySize { rows: 30, cols: 96, pixel_width: 0, pixel_height: 0 })?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
    let cmd = CommandBuilder::new(shell);
    let mut child = pair.slave.spawn_command(cmd)?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader()?;
    let mut writer = pair.master.take_writer()?;
    let master = pair.master;

    // PTY output → WebSocket (blocking read on a thread, forwarded via a channel).
    let (out_tx, mut out_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if out_tx.blocking_send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });

    loop {
        tokio::select! {
            out = out_rx.recv() => match out {
                Some(bytes) => { if ws_tx.send(Message::Binary(bytes)).await.is_err() { break; } }
                None => break, // PTY closed
            },
            incoming = ws_rx.next() => match incoming {
                Some(Ok(Message::Binary(data))) => { let _ = writer.write_all(&data); let _ = writer.flush(); }
                Some(Ok(Message::Text(txt))) => {
                    if let Ok(msg) = serde_json::from_str::<ClientMsg>(&txt) {
                        if let Some(r) = msg.resize {
                            let _ = master.resize(PtySize { rows: r.rows, cols: r.cols, pixel_width: 0, pixel_height: 0 });
                        }
                    } else {
                        // Treat plain text as keystrokes too.
                        let _ = writer.write_all(txt.as_bytes());
                        let _ = writer.flush();
                    }
                }
                Some(Ok(Message::Close(_))) | None => break,
                _ => {}
            }
        }
    }

    let _ = child.kill();
    Ok(())
}
