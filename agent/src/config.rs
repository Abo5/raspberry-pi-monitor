//! Config: defaults → agent.toml (if present) → a few env overrides.
//! Actions are defined here (the Pi-side allow-list).

use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct Config {
    pub name: String,
    pub bind_addr: String,
    pub interval_s: u64,
    pub token: String,
    pub db_path: String,
    pub retention_days: u32,
    pub actions: Vec<ActionDef>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ActionDef {
    pub id: String,
    #[serde(default)]
    pub category: String,
    pub name: String,
    pub command: String,
    #[serde(default = "default_dur", rename = "expected_duration_s")]
    pub expected_duration_s: u64,
    #[serde(default)]
    pub destructive: bool,
    #[serde(default, rename = "drops_tunnel")]
    pub drops_tunnel: bool,
}
fn default_dur() -> u64 {
    5
}

// ---- agent.toml shape ----
#[derive(Deserialize, Default)]
struct TomlRoot {
    #[serde(default)]
    agent: TomlAgent,
    #[serde(default)]
    storage: TomlStorage,
    #[serde(default, rename = "actions")]
    actions: Vec<ActionDef>,
}
#[derive(Deserialize, Default)]
struct TomlAgent {
    name: Option<String>,
    bind_addr: Option<String>,
    sampling_interval_s: Option<u64>,
    token: Option<String>,
}
#[derive(Deserialize, Default)]
struct TomlStorage {
    db_path: Option<String>,
    raw_retention_days: Option<u32>,
}

impl Config {
    pub fn load() -> Self {
        // defaults
        let mut name = hostname();
        let mut bind_addr = "0.0.0.0:8443".to_string();
        let mut interval_s = 5u64;
        let mut token: Option<String> = None;
        let mut db_path = default_db_path();
        let mut retention_days = 90u32;
        let mut actions = default_actions();

        // agent.toml
        let cfg_path = std::env::var("AGENT_CONFIG").unwrap_or_else(|_| "agent.toml".into());
        if let Ok(text) = std::fs::read_to_string(&cfg_path) {
            match toml::from_str::<TomlRoot>(&text) {
                Ok(root) => {
                    if let Some(v) = root.agent.name { name = v; }
                    if let Some(v) = root.agent.bind_addr { bind_addr = v; }
                    if let Some(v) = root.agent.sampling_interval_s { interval_s = v; }
                    if let Some(v) = root.agent.token { token = Some(v); }
                    if let Some(v) = root.storage.db_path { db_path = v; }
                    if let Some(v) = root.storage.raw_retention_days { retention_days = v; }
                    if !root.actions.is_empty() { actions = root.actions; }
                }
                Err(e) => tracing::warn!("agent.toml parse error, using defaults: {e}"),
            }
        }

        // env overrides (highest priority for the deploy-critical ones)
        if let Ok(v) = std::env::var("AGENT_NAME") { name = v; }
        if let Ok(v) = std::env::var("AGENT_BIND") { bind_addr = v; }
        if let Ok(v) = std::env::var("AGENT_INTERVAL_S") { if let Ok(n) = v.parse() { interval_s = n; } }
        if let Ok(v) = std::env::var("AGENT_TOKEN") { token = Some(v); }
        if let Ok(v) = std::env::var("AGENT_DB") { db_path = v; }

        Config {
            name,
            bind_addr,
            interval_s,
            token: token.unwrap_or_else(random_token),
            db_path,
            retention_days,
            actions,
        }
    }
}

fn default_actions() -> Vec<ActionDef> {
    vec![
        ActionDef { id: "restart-pihole".into(), category: "Services".into(), name: "Restart Pi-hole".into(),
            command: "systemctl restart pihole-FTL".into(), expected_duration_s: 4, destructive: false, drops_tunnel: false },
        ActionDef { id: "apt-upgrade".into(), category: "Maintenance".into(), name: "Update packages".into(),
            command: "apt-get -y upgrade".into(), expected_duration_s: 240, destructive: false, drops_tunnel: false },
        ActionDef { id: "reboot".into(), category: "Power".into(), name: "Reboot".into(),
            command: "sudo systemctl reboot".into(), expected_duration_s: 50, destructive: true, drops_tunnel: true },
        // The one sanctioned way to stop the always-restarting agent from the
        // app. Plain `stop` (not disable): it returns on the next boot.
        ActionDef { id: "stop-agent".into(), category: "Power".into(), name: "Stop Agent (until reboot)".into(),
            command: "systemctl --user stop raspberry-agent".into(), expected_duration_s: 2, destructive: true, drops_tunnel: true },
    ]
}

fn hostname() -> String {
    std::fs::read_to_string("/proc/sys/kernel/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "raspberry-pi".into())
}

fn default_db_path() -> String {
    if let Ok(home) = std::env::var("HOME") {
        let dir = format!("{home}/.local/share/raspberry-agent");
        let _ = std::fs::create_dir_all(&dir);
        format!("{dir}/agent.db")
    } else {
        "raspberry-agent.db".into()
    }
}

fn random_token() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..24).map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char).collect()
}
