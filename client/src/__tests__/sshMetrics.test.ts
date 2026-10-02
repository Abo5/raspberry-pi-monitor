import { parseReading, toValues } from '../net/sshMetrics';

const S = '@@PIMON@@';

function output(opts: { user: number; idle: number; rx: number; tx: number }) {
  return [
    `cpu  ${opts.user} 0 100 ${opts.idle} 50 0 0 0 0 0`,
    '48312',
    'MemTotal:        8000000 kB\nMemAvailable:    6000000 kB',
    '/dev/root 100000000 25000000 75000000 25% /',
    [
      'Inter-|   Receive                                                |  Transmit',
      ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
      `    lo: 999999 10 0 0 0 0 0 0 999999 10 0 0 0 0 0 0`,
      `  eth0: ${opts.rx} 10 0 0 0 0 0 0 ${opts.tx} 10 0 0 0 0 0 0`,
      ` wlan0: 1000 10 0 0 0 0 0 0 2000 10 0 0 0 0 0 0`,
    ].join('\n'),
    '0.42 0.30 0.25 1/300 1234',
    '12345.67 40000.00',
    '1800000',
    'kali',
  ].join(`\n${S}\n`) + `\n${S}\n`;
}

describe('sshMetrics', () => {
  it('parses instant values from one reading', () => {
    const r = parseReading(output({ user: 1000, idle: 9000, rx: 5000, tx: 3000 }), 0);
    expect(r.values['cpu.temp_c']).toBeCloseTo(48.312);
    expect(r.values['mem.used_pct']).toBeCloseTo(25);
    expect(r.values['mem.available_bytes']).toBe(6000000 * 1024);
    expect(r.values['disk.used_pct']).toBeCloseTo(25);
    expect(r.values['load.1m']).toBeCloseTo(0.42);
    expect(r.values['sys.uptime_s']).toBeCloseTo(12345.67);
    expect(r.values['cpu.freq_mhz']).toBe(1800);
    expect(r.hostname).toBe('kali');
    // Loopback is excluded from network totals.
    expect(r.rxBytes).toBe(5000 + 1000);
    expect(r.txBytes).toBe(3000 + 2000);
  });

  it('derives CPU % and network bytes/s from two readings', () => {
    const a = parseReading(output({ user: 1000, idle: 9000, rx: 5000, tx: 3000 }), 0);
    const b = parseReading(output({ user: 1300, idle: 9700, rx: 8000, tx: 4000 }), 2000);
    const v = toValues(b, a);
    // Δtotal = 300 + 700 = 1000, Δidle = 700 → 30 % busy.
    expect(v['cpu.util_pct']).toBeCloseTo(30);
    expect(v['net.rx_bps']).toBeCloseTo(1500); // 3000 B over 2 s
    expect(v['net.tx_bps']).toBeCloseTo(500);
  });

  it('has no rates on the first reading and skips counter resets', () => {
    const a = parseReading(output({ user: 1000, idle: 9000, rx: 5000, tx: 3000 }), 0);
    expect(toValues(a, null)['cpu.util_pct']).toBeUndefined();
    const reset = parseReading(output({ user: 1100, idle: 9100, rx: 10, tx: 10 }), 1000);
    const v = toValues(reset, a);
    expect(v['net.rx_bps']).toBeUndefined();
  });

  it('tolerates missing sources', () => {
    const r = parseReading(`cpu  1 2 3 4\n${S}\n${S}\n${S}\n${S}\n${S}\n${S}\n${S}\n${S}\n${S}\n`, 0);
    expect(r.values['cpu.temp_c']).toBeUndefined();
    expect(r.values['mem.used_pct']).toBeUndefined();
    expect(r.hostname).toBeNull();
  });
});
