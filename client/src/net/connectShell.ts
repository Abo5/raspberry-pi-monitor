// Run commands on the Pi through Raspberry Pi Connect's remote shell — no SSH
// password needed, only the Connect sign-in. A hidden WebView holds the shell
// session (components/ConnectMonitor.tsx) and hands us a way to type into it;
// each command's output comes back between numbered markers (CONNECT_SHELL_JS).
// Commands run one at a time, like a person typing into the terminal.

type Pending = { resolve: (out: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

let typeIn: ((text: string) => void) | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let queue: Promise<unknown> = Promise.resolve();

/** The hidden session's shell is open: `send` types text into it. */
export function attachShell(send: (text: string) => void): void {
  typeIn = send;
}

/** The session went away: fail whatever is still waiting. */
export function detachShell(): void {
  typeIn = null;
  pending.forEach((p) => {
    clearTimeout(p.timer);
    p.reject(new Error('shell closed'));
  });
  pending.clear();
}

export function shellAttached(): boolean {
  return typeIn !== null;
}

/** Output for command `id` arrived from the page. */
export function onShellResult(id: number, out: string): void {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  clearTimeout(p.timer);
  p.resolve(out);
}

/** The exact line typed for one command (exported for tests). */
export function shellLine(id: number, command: string): string {
  // Leading space: shells that honour ignorespace keep it out of history.
  return ` printf '@@PM_B%s@@\\n' ${id}; ${command}; printf '@@PM_E%s@@\\n' ${id}\r`;
}

function runOne(command: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!typeIn) {
      reject(new Error('shell not open'));
      return;
    }
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('shell timeout'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    typeIn(shellLine(id, command));
  });
}

/** Run one command in the Connect shell; resolves with its output. */
export function connectExec(command: string, timeoutMs = 15000): Promise<string> {
  const next = queue.then(() => runOne(command, timeoutMs));
  queue = next.catch(() => {});
  return next;
}
