import { CONNECT_SHELL_JS } from '../net/connect';
import { attachShell, connectExec, detachShell, onShellResult, shellLine } from '../net/connectShell';

// Load the injected page script against a fake WebRTC data channel.
function loadPage() {
  const posted: any[] = [];
  const listeners: Record<string, ((e?: any) => void)[]> = {};
  const channel: any = {
    readyState: 'open',
    sent: [] as string[],
    addEventListener: (t: string, f: (e?: any) => void) => (listeners[t] ??= []).push(f),
    send(s: string) { this.sent.push(s); },
  };
  class PC { createDataChannel() { return channel; } }
  const win: any = { RTCPeerConnection: PC, ReactNativeWebView: { postMessage: (m: string) => posted.push(JSON.parse(m)) } };
  new Function('window', 'TextDecoder', CONNECT_SHELL_JS)(win, TextDecoder);
  new win.RTCPeerConnection().createDataChannel('shell');
  const feed = (text: string, chunk = 7) => {
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i += chunk) {
      listeners.message.forEach((f) => f({ data: bytes.slice(i, i + chunk).buffer }));
    }
  };
  return { win, channel, posted, feed, fire: (t: string) => listeners[t]?.forEach((f) => f()) };
}

// What a zsh terminal sends back for one typed line: a coloured prompt, the
// echoed line (with the %s marker form), the output with \r\n, then a prompt.
const PROMPT = '\x1b]0;pi@pi: ~\x07\r\x1b[0m\x1b[32m┌──(\x1b[1mpi㉿pi\x1b[0m)-[~]\r\n└─\x1b[34m$\x1b[0m ';
const terminal = (id: number, cmd: string, out: string) =>
  PROMPT + shellLine(id, cmd).replace('\r', '') + '\r\n' + `@@PM_B${id}@@\r\n` + out.replace(/\n/g, '\r\n') + `@@PM_E${id}@@\r\n` + PROMPT;

describe('Connect remote-shell page hook', () => {
  it('returns only the command output, never the echoed line', () => {
    const page = loadPage();
    page.fire('open');
    expect(page.posted).toContainEqual({ type: 'shell-open' });
    page.feed(terminal(3, 'cat /proc/loadavg', '0.08 0.07 0.03 1/576 3693897\n'));
    expect(page.posted.filter((m) => m.type === 'shell-result')).toEqual([
      { type: 'shell-result', id: 3, out: '0.08 0.07 0.03 1/576 3693897\n' },
    ]);
  });

  it('types into the open channel', () => {
    const page = loadPage();
    expect(page.win.__pimonShellSend('ls\r')).toBe(true);
    expect(page.channel.sent).toEqual(['ls\r']);
    page.channel.readyState = 'closed';
    expect(page.win.__pimonShellSend('ls\r')).toBe(false);
  });
});

describe('connectExec', () => {
  afterEach(() => detachShell());

  it('runs commands one at a time and matches results by id', async () => {
    const typed: string[] = [];
    attachShell((t) => typed.push(t));
    const a = connectExec('echo a');
    const b = connectExec('echo b');
    await Promise.resolve();
    expect(typed).toHaveLength(1); // b waits for a
    const idA = Number(/%s@@\\n' (\d+);/.exec(typed[0])![1]);
    onShellResult(idA, 'a\n');
    await expect(a).resolves.toBe('a\n');
    await new Promise((r) => setTimeout(r, 0));
    expect(typed).toHaveLength(2);
    const idB = Number(/%s@@\\n' (\d+);/.exec(typed[1])![1]);
    onShellResult(idB, 'b\n');
    await expect(b).resolves.toBe('b\n');
  });

  it('fails waiting commands when the shell closes', async () => {
    attachShell(() => {});
    const p = connectExec('sleep 100');
    await Promise.resolve();
    detachShell();
    await expect(p).rejects.toThrow('shell closed');
  });

  it('fails right away with no shell', async () => {
    await expect(connectExec('true')).rejects.toThrow('shell not open');
  });
});
