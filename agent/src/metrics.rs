//! Metric sampler — reads the same `/proc` and `/sys` sources the plan lists
//! (identical on Pi 4 and Pi 5). Rates (CPU, network) are computed from deltas
//! between samples, so the sampler holds a little previous state.
//!
//! Missing sources are simply skipped (e.g. on a dev macOS host), so the binary
//! compiles and runs anywhere; on a real Pi every value is populated.
//!
//! On macOS the readers that have a native equivalent (CPU, memory, load,
//! uptime) fall back to sysctl/mach so a dev host still shows real numbers;
//! temperature, CPU frequency and network rates stay honestly absent there.

use std::collections::BTreeMap;
use std::time::Instant;

pub type Values = BTreeMap<String, f64>;

#[derive(Default)]
pub struct Sampler {
    prev_cpu: Option<CpuTimes>,
    prev_net: Option<(u64, u64)>, // (rx_bytes, tx_bytes)
    prev_instant: Option<Instant>,
}

#[derive(Clone, Copy)]
struct CpuTimes {
    idle: u64,
    total: u64,
}

impl Sampler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Take one reading of every MVP series.
    pub fn sample(&mut self) -> Values {
        let now = Instant::now();
        let dt = self
            .prev_instant
            .map(|p| now.duration_since(p).as_secs_f64())
            .filter(|s| *s > 0.0);
        self.prev_instant = Some(now);

        let mut v = Values::new();

        if let Some(t) = read_temp_c() {
            v.insert("cpu.temp_c".into(), t);
        }
        if let Some(cpu) = read_cpu_times() {
            if let Some(prev) = self.prev_cpu {
                let dtotal = cpu.total.saturating_sub(prev.total) as f64;
                let didle = cpu.idle.saturating_sub(prev.idle) as f64;
                if dtotal > 0.0 {
                    v.insert("cpu.util_pct".into(), ((dtotal - didle) / dtotal * 100.0).clamp(0.0, 100.0));
                }
            }
            self.prev_cpu = Some(cpu);
        }
        if let Some(mhz) = read_first_u64("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq") {
            v.insert("cpu.freq_mhz".into(), mhz as f64 / 1000.0);
        }
        if let Some((total, avail)) = read_mem() {
            if total > 0 {
                v.insert("mem.used_pct".into(), (1.0 - avail as f64 / total as f64) * 100.0);
                v.insert("mem.available_bytes".into(), avail as f64 * 1024.0);
            }
        }
        if let Some((used_pct, free_bytes)) = read_disk("/") {
            v.insert("disk.used_pct".into(), used_pct);
            v.insert("disk.free_bytes".into(), free_bytes);
        }
        if let Some((rx, tx)) = read_net_bytes() {
            if let (Some((prx, ptx)), Some(dt)) = (self.prev_net, dt) {
                v.insert("net.rx_bps".into(), rx.saturating_sub(prx) as f64 / dt);
                v.insert("net.tx_bps".into(), tx.saturating_sub(ptx) as f64 / dt);
            }
            self.prev_net = Some((rx, tx));
        }
        if let Some(load) = read_loadavg() {
            v.insert("load.1m".into(), load);
        }
        if let Some(up) = read_uptime() {
            v.insert("sys.uptime_s".into(), up);
        }

        v
    }
}

fn read_temp_c() -> Option<f64> {
    let milli: f64 = std::fs::read_to_string("/sys/class/thermal/thermal_zone0/temp")
        .ok()?
        .trim()
        .parse()
        .ok()?;
    Some(milli / 1000.0)
}

#[cfg(target_os = "macos")]
fn read_cpu_times() -> Option<CpuTimes> {
    macos::cpu_times()
}

#[cfg(not(target_os = "macos"))]
fn read_cpu_times() -> Option<CpuTimes> {
    let stat = std::fs::read_to_string("/proc/stat").ok()?;
    let line = stat.lines().next()?; // "cpu  user nice system idle iowait irq softirq steal ..."
    let mut it = line.split_whitespace();
    if it.next()? != "cpu" {
        return None;
    }
    let nums: Vec<u64> = it.filter_map(|x| x.parse().ok()).collect();
    if nums.len() < 5 {
        return None;
    }
    let idle = nums[3] + nums.get(4).copied().unwrap_or(0); // idle + iowait
    let total: u64 = nums.iter().sum();
    Some(CpuTimes { idle, total })
}

fn read_first_u64(path: &str) -> Option<u64> {
    std::fs::read_to_string(path).ok()?.trim().parse().ok()
}

#[cfg(target_os = "macos")]
fn read_mem() -> Option<(u64, u64)> {
    macos::mem_kb()
}

#[cfg(not(target_os = "macos"))]
fn read_mem() -> Option<(u64, u64)> {
    let text = std::fs::read_to_string("/proc/meminfo").ok()?;
    let mut total = None;
    let mut avail = None;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("MemTotal:") {
            total = rest.split_whitespace().next().and_then(|x| x.parse().ok());
        } else if let Some(rest) = line.strip_prefix("MemAvailable:") {
            avail = rest.split_whitespace().next().and_then(|x| x.parse().ok());
        }
    }
    Some((total?, avail?)) // in kB
}

fn read_disk(path: &str) -> Option<(f64, f64)> {
    use std::ffi::CString;
    let c = CString::new(path).ok()?;
    let mut st: libc::statvfs = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::statvfs(c.as_ptr(), &mut st) };
    if rc != 0 {
        return None;
    }
    let bsize = st.f_frsize as f64;
    let total = st.f_blocks as f64 * bsize;
    let free = st.f_bavail as f64 * bsize;
    if total <= 0.0 {
        return None;
    }
    let used_pct = (1.0 - free / total) * 100.0;
    Some((used_pct, free))
}

fn read_net_bytes() -> Option<(u64, u64)> {
    // Sum rx/tx across interfaces except loopback, via /sys/class/net/*/statistics.
    let dir = std::fs::read_dir("/sys/class/net").ok()?;
    let mut rx = 0u64;
    let mut tx = 0u64;
    let mut any = false;
    for entry in dir.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name == "lo" {
            continue;
        }
        let base = entry.path().join("statistics");
        if let Some(r) = read_first_u64(base.join("rx_bytes").to_str()?) {
            rx += r;
            any = true;
        }
        if let Some(t) = read_first_u64(base.join("tx_bytes").to_str()?) {
            tx += t;
            any = true;
        }
    }
    if any {
        Some((rx, tx))
    } else {
        None
    }
}

#[cfg(target_os = "macos")]
fn read_loadavg() -> Option<f64> {
    macos::loadavg_1m()
}

#[cfg(not(target_os = "macos"))]
fn read_loadavg() -> Option<f64> {
    std::fs::read_to_string("/proc/loadavg")
        .ok()?
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

#[cfg(target_os = "macos")]
fn read_uptime() -> Option<f64> {
    macos::uptime_s()
}

#[cfg(not(target_os = "macos"))]
fn read_uptime() -> Option<f64> {
    std::fs::read_to_string("/proc/uptime")
        .ok()?
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

/// Native readers for a macOS dev host. Never compiled for the Pi.
#[cfg(target_os = "macos")]
mod macos {
    use super::CpuTimes;

    extern "C" {
        fn mach_host_self() -> u32;
        fn host_statistics(host: u32, flavor: i32, out: *mut i32, count: *mut u32) -> i32;
        fn host_statistics64(host: u32, flavor: i32, out: *mut i32, count: *mut u32) -> i32;
    }

    const HOST_CPU_LOAD_INFO: i32 = 3; // 4 ticks: user, system, idle, nice
    const HOST_VM_INFO64: i32 = 4;
    const HOST_VM_INFO64_COUNT: u32 = 38;

    pub fn cpu_times() -> Option<CpuTimes> {
        let mut ticks = [0i32; 4];
        let mut count = 4u32;
        let rc = unsafe {
            host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, ticks.as_mut_ptr(), &mut count)
        };
        if rc != 0 || count < 4 {
            return None;
        }
        let t: Vec<u64> = ticks.iter().map(|&x| x as u32 as u64).collect();
        Some(CpuTimes { idle: t[2], total: t.iter().sum() })
    }

    /// (total_kb, available_kb) — the same contract as /proc/meminfo.
    /// Available ≈ free + inactive pages, in units of the VM page size.
    pub fn mem_kb() -> Option<(u64, u64)> {
        let total_bytes = sysctl_u64("hw.memsize")?;
        let page = sysctl_u64("hw.pagesize")?;
        let mut words = [0i32; HOST_VM_INFO64_COUNT as usize];
        let mut count = HOST_VM_INFO64_COUNT;
        let rc = unsafe {
            host_statistics64(mach_host_self(), HOST_VM_INFO64, words.as_mut_ptr(), &mut count)
        };
        if rc != 0 || count < 3 {
            return None;
        }
        let free = words[0] as u32 as u64;
        let inactive = words[2] as u32 as u64;
        let avail_bytes = (free + inactive) * page;
        Some((total_bytes / 1024, avail_bytes.min(total_bytes) / 1024))
    }

    pub fn loadavg_1m() -> Option<f64> {
        let mut l = [0f64; 3];
        let n = unsafe { libc::getloadavg(l.as_mut_ptr(), 3) };
        if n >= 1 { Some(l[0]) } else { None }
    }

    pub fn uptime_s() -> Option<f64> {
        let mut tv = libc::timeval { tv_sec: 0, tv_usec: 0 };
        let mut len = std::mem::size_of::<libc::timeval>();
        let mut mib = [libc::CTL_KERN, libc::KERN_BOOTTIME];
        let rc = unsafe {
            libc::sysctl(
                mib.as_mut_ptr(),
                2,
                &mut tv as *mut _ as *mut libc::c_void,
                &mut len,
                std::ptr::null_mut(),
                0,
            )
        };
        if rc != 0 || tv.tv_sec == 0 {
            return None;
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs_f64();
        Some((now - tv.tv_sec as f64).max(0.0))
    }

    fn sysctl_u64(name: &str) -> Option<u64> {
        let cname = std::ffi::CString::new(name).ok()?;
        let mut val: u64 = 0;
        let mut len = std::mem::size_of::<u64>();
        let rc = unsafe {
            libc::sysctlbyname(
                cname.as_ptr(),
                &mut val as *mut _ as *mut libc::c_void,
                &mut len,
                std::ptr::null_mut(),
                0,
            )
        };
        if rc != 0 || val == 0 {
            return None;
        }
        Some(val)
    }
}
