use rand::Rng;

/// Phase-1 config. A real build reads agent.toml; the MVP takes env/defaults and
/// generates a bearer token on first run.
#[derive(Clone)]
pub struct Config {
    pub name: String,
    pub bind_addr: String,
    pub interval_s: u64,
    pub token: String,
}

impl Config {
    pub fn load() -> Self {
        let name = std::env::var("AGENT_NAME").unwrap_or_else(|_| hostname());
        let bind_addr = std::env::var("AGENT_BIND").unwrap_or_else(|_| "0.0.0.0:8443".into());
        let interval_s = std::env::var("AGENT_INTERVAL_S")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5);
        let token = std::env::var("AGENT_TOKEN").unwrap_or_else(|_| random_token());
        Config { name, bind_addr, interval_s, token }
    }
}

fn hostname() -> String {
    std::fs::read_to_string("/proc/sys/kernel/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "raspberry-pi".into())
}

fn random_token() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..24).map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char).collect()
}
