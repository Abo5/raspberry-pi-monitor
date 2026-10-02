// The session key bar: exact keys into Connect's desktop (VNC keysyms) and
// exact terminal bytes into its remote shell.
import { SESSION_CHROME_JS } from '../net/connect';

function loadSession(kind: 'vnc' | 'shell') {
  const sent: any[] = [];
  const rfb = { sendKey: (ks: number, code: string | null, down?: boolean) => sent.push([ks, code, down]) };
  const socket = { readyState: 'open', send: (s: string) => sent.push(s) };
  const el = { kind };
  const document: any = {
    head: { appendChild() {} },
    documentElement: {},
    activeElement: null,
    createElement: () => ({ setAttribute() {}, style: {} }),
    querySelector: (sel: string) => (sel.includes(`data-controller~="${kind}"`) ? el : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const win: any = {
    ReactNativeWebView: { postMessage() {} },
    Stimulus: {
      getControllerForElementAndIdentifier: (e: any, name: string) =>
        e === el && name === kind ? (kind === 'vnc' ? { rfb } : { connection: { socket } }) : null,
    },
  };
  class MO { observe() {} }
  new Function('window', 'document', 'MutationObserver', 'setTimeout', SESSION_CHROME_JS)(win, document, MO, () => 0);
  return { win, sent };
}

describe('desktop (VNC) keys', () => {
  it('sends F1, F5, Tab and arrows as X11 keysyms', () => {
    const { win, sent } = loadSession('vnc');
    win.__pimonPress([], 'F1');
    win.__pimonPress([], 'F5');
    win.__pimonPress([], 'Tab');
    win.__pimonPress([], 'ArrowLeft');
    win.__pimonPress([], 'ArrowRight');
    expect(sent).toEqual([
      [0xffbe, 'F1', undefined],
      [0xffc2, 'F5', undefined],
      [0xff09, 'Tab', undefined],
      [0xff51, 'ArrowLeft', undefined],
      [0xff53, 'ArrowRight', undefined],
    ]);
  });

  it('holds modifiers around the key (Ctrl+Alt+t)', () => {
    const { win, sent } = loadSession('vnc');
    win.__pimonPress(['Ctrl', 'Alt'], 't');
    expect(sent).toEqual([
      [0xffe3, 'ControlLeft', true],
      [0xffe9, 'AltLeft', true],
      [0x74, null, undefined],
      [0xffe9, 'AltLeft', false],
      [0xffe3, 'ControlLeft', false],
    ]);
  });

  it('the Raspberry key is Super', () => {
    const { win, sent } = loadSession('vnc');
    win.__pimonPress([], 'Super');
    expect(sent).toEqual([[0xffeb, 'MetaLeft', undefined]]);
  });

  it('pastes text key by key, with Enter for new lines', () => {
    const { win, sent } = loadSession('vnc');
    win.__pimonPaste('aB\n');
    expect(sent).toEqual([[0x61, null, undefined], [0x42, null, undefined], [0xff0d, 'Enter', undefined]]);
  });
});

describe('shell keys', () => {
  it('sends terminal sequences', () => {
    const { win, sent } = loadSession('shell');
    win.__pimonPress([], 'Tab');
    win.__pimonPress([], 'F1');
    win.__pimonPress([], 'F5');
    win.__pimonPress([], 'ArrowLeft');
    win.__pimonPress([], 'ArrowRight');
    expect(sent).toEqual(['\t', '\x1bOP', '\x1b[15~', '\x1b[D', '\x1b[C']);
  });

  it('applies Ctrl, Shift and Alt', () => {
    const { win, sent } = loadSession('shell');
    win.__pimonPress(['Ctrl'], 'c');
    win.__pimonPress(['Shift'], 'a');
    win.__pimonPress(['Alt'], 'b');
    win.__pimonPress(['Shift'], 'Tab');
    expect(sent).toEqual(['\x03', 'A', '\x1bb', '\x1b[Z']);
  });

  it('encodes modifiers on special keys like xterm', () => {
    const { win, sent } = loadSession('shell');
    win.__pimonPress(['Ctrl'], 'F5');
    win.__pimonPress(['Ctrl'], 'ArrowLeft');
    win.__pimonPress(['Alt'], 'ArrowLeft');
    win.__pimonPress(['Shift'], 'F1');
    win.__pimonPress(['Ctrl', 'Shift'], 'End');
    win.__pimonPress(['Ctrl', 'Alt'], 'Delete');
    expect(sent).toEqual(['\x1b[15;5~', '\x1b[1;5D', '\x1b[1;3D', '\x1b[1;2P', '\x1b[1;6F', '\x1b[3;7~']);
  });

  it('pastes with terminal line endings', () => {
    const { win, sent } = loadSession('shell');
    win.__pimonPaste('ls -la\npwd');
    expect(sent).toEqual(['ls -la\rpwd']);
  });
});

describe('the full key set', () => {
  const F = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);

  it('desktop: F1–F12 are keysyms 0xFFBE–0xFFC9', () => {
    const { win, sent } = loadSession('vnc');
    F.forEach((k) => win.__pimonPress([], k));
    expect(sent.map((x) => x[0])).toEqual(F.map((_, i) => 0xffbe + i));
    expect(sent.map((x) => x[1])).toEqual(F);
  });

  it('desktop: navigation keys and Ctrl+Alt+Del', () => {
    const { win, sent } = loadSession('vnc');
    ['Escape', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace', 'Enter', 'PrintScreen', 'ArrowUp', 'ArrowDown']
      .forEach((k) => win.__pimonPress([], k));
    expect(sent.map((x) => x[0])).toEqual([0xff1b, 0xff50, 0xff57, 0xff55, 0xff56, 0xff63, 0xffff, 0xff08, 0xff0d, 0xff61, 0xff52, 0xff54]);
    sent.length = 0;
    win.__pimonPress(['Ctrl', 'Alt'], 'Delete');
    expect(sent).toEqual([
      [0xffe3, 'ControlLeft', true], [0xffe9, 'AltLeft', true], [0xffff, 'Delete', undefined],
      [0xffe9, 'AltLeft', false], [0xffe3, 'ControlLeft', false],
    ]);
  });

  it('shell: F1–F12 and navigation keys send xterm sequences', () => {
    const { win, sent } = loadSession('shell');
    F.forEach((k) => win.__pimonPress([], k));
    ['Escape', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace', 'Enter', 'ArrowUp', 'ArrowDown']
      .forEach((k) => win.__pimonPress([], k));
    expect(sent).toEqual([
      '\x1bOP', '\x1bOQ', '\x1bOR', '\x1bOS', '\x1b[15~', '\x1b[17~', '\x1b[18~', '\x1b[19~', '\x1b[20~', '\x1b[21~', '\x1b[23~', '\x1b[24~',
      '\x1b', '\x1b[H', '\x1b[F', '\x1b[5~', '\x1b[6~', '\x1b[2~', '\x1b[3~', '\x7f', '\r', '\x1b[A', '\x1b[B',
    ]);
  });
});
