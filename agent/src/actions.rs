//! Action runner. Executes ONLY commands from the config allow-list (never a
//! raw command from the network). Returns the exit status + captured stderr.

use std::process::Stdio;

use serde::Serialize;
use tokio::process::Command;

use crate::config::ActionDef;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub id: String,
    pub exit_code: i32,
    pub duration_s: f64,
    pub stderr_tail: String,
    pub ok: bool,
}

/// Run one allow-listed action. `def` came from the trusted config, not the
/// network; we only ever run `def.command`.
pub async fn run(def: &ActionDef, started: std::time::Instant) -> ActionResult {
    // Execute via a shell so `systemctl restart x` etc. work as written.
    let output = Command::new("sh")
        .arg("-c")
        .arg(&def.command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    let duration_s = started.elapsed().as_secs_f64();
    match output {
        Ok(o) => {
            let code = o.status.code().unwrap_or(-1);
            let stderr = String::from_utf8_lossy(&o.stderr);
            let tail: String = stderr.lines().rev().take(6).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
            ActionResult { id: def.id.clone(), exit_code: code, duration_s, stderr_tail: tail, ok: code == 0 }
        }
        Err(e) => ActionResult {
            id: def.id.clone(),
            exit_code: -1,
            duration_s,
            stderr_tail: format!("failed to spawn: {e}"),
            ok: false,
        },
    }
}
