// Typing on the Pi's desktop from our own keyboard: each key goes over the
// Monitor's SSH session to `xdotool`, which types it into the Pi's X11 desktop
// session. The Raspberry Pi Connect page just shows the result on screen —
// nothing is injected into it.
import { sshExec } from './sshMonitor';

const MODS: Record<string, string> = { Ctrl: 'ctrl', Alt: 'alt', Shift: 'shift', Super: 'super' };

// X keysym names for the printable characters on our keyboard.
const KEYSYM: Record<string, string> = {
  '`': 'grave', '-': 'minus', '=': 'equal', '[': 'bracketleft', ']': 'bracketright', '\\': 'backslash',
  ';': 'semicolon', "'": 'apostrophe', ',': 'comma', '.': 'period', '/': 'slash', '~': 'asciitilde',
  '!': 'exclam', '@': 'at', '#': 'numbersign', '$': 'dollar', '%': 'percent', '^': 'asciicircum',
  '&': 'ampersand', '*': 'asterisk', '(': 'parenleft', ')': 'parenright', '_': 'underscore', '+': 'plus',
  '{': 'braceleft', '}': 'braceright', '|': 'bar', ':': 'colon', '"': 'quotedbl', '<': 'less',
  '>': 'greater', '?': 'question', ' ': 'space',
};

/** Single-quote a string for sh. */
export const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * The xdotool command for one key from RemoteKeyboard: "a", "Return",
 * "Ctrl+c", "Ctrl+Alt+Delete", "!" …
 */
export function xdotoolFor(key: string): string {
  // Split off modifiers ("Ctrl+Alt+x"); a bare "+" key is the character itself.
  const parts = key === '+' ? ['+'] : key.split('+');
  const base = parts.pop() || '+';
  const mods = parts.map((m) => MODS[m]).filter(Boolean);
  if (!mods.length && base.length === 1) {
    // Plain character: `type` handles shift/layout for us.
    return `xdotool type --clearmodifiers -- ${shQuote(base)}`;
  }
  const sym = base.length === 1 ? KEYSYM[base] ?? base : base;
  return `xdotool key --clearmodifiers ${shQuote([...mods, sym].join('+'))}`;
}

// Talk to the desktop of the user logged in on the Pi's screen.
const X11_ENV =
  'export DISPLAY="${DISPLAY:-:0}"; [ -n "$XAUTHORITY" ] || export XAUTHORITY="$HOME/.Xauthority"; ' +
  'command -v xdotool >/dev/null 2>&1 || { echo PIMON_NO_XDOTOOL; exit 0; }; ';

export type DesktopKeyResult = 'ok' | 'noSsh' | 'noXdotool' | 'noDisplay' | 'failed';

export function sendDesktopKey(key: string): Promise<DesktopKeyResult> {
  return runX11(xdotoolFor(key));
}

/** Click a mouse button where the Pi's pointer is now (3 = right click). */
export function sendDesktopClick(button: 1 | 2 | 3): Promise<DesktopKeyResult> {
  return runX11(`xdotool click ${button}`);
}

async function runX11(command: string): Promise<DesktopKeyResult> {
  const r = await sshExec(X11_ENV + command);
  if (!r) return 'noSsh';
  if (r.output.includes('PIMON_NO_XDOTOOL')) return 'noXdotool';
  if (/Can't open display|cannot open display|Authorization required/i.test(r.output)) return 'noDisplay';
  return r.exitCode === 0 ? 'ok' : 'failed';
}
