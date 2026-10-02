//! Non-interactive command runner for the "Live Commands" monitor.
//!
//! Runs a single shell command with a timeout, captures stdout/stderr, and
//! returns the result as JSON. Same trust model as the interactive shell: any
//! paired client can already run arbitrary commands over `/shell`, so this just
//! makes that convenient and pollable for the automatic monitor page.

use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecBody {
    pub command: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}

fn default_timeout() -> u64 {
    8000
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub ok: bool,
    pub timed_out: bool,
}

pub async fn run(command: &str, timeout_ms: u64) -> ExecResult {
    let started = Instant::now();
    let fut = Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match tokio::time::timeout(Duration::from_millis(timeout_ms), fut).await {
        Err(_) => ExecResult {
            stdout: String::new(),
            stderr: format!("timed out after {timeout_ms} ms"),
            exit_code: -1,
            duration_ms: started.elapsed().as_millis() as u64,
            ok: false,
            timed_out: true,
        },
        Ok(Err(e)) => ExecResult {
            stdout: String::new(),
            stderr: format!("spawn failed: {e}"),
            exit_code: -1,
            duration_ms: started.elapsed().as_millis() as u64,
            ok: false,
            timed_out: false,
        },
        Ok(Ok(o)) => ExecResult {
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            exit_code: o.status.code().unwrap_or(-1),
            duration_ms: started.elapsed().as_millis() as u64,
            ok: o.status.success(),
            timed_out: false,
        },
    }
}
