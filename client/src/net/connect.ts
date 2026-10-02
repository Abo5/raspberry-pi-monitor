// Raspberry Pi Connect (the official cloud at connect.raspberrypi.com) integration.
//
// The app is gated behind a real Raspberry Pi Connect sign-in. We do NOT build a
// native login form: sign-in runs through id.raspberrypi.com OAuth *behind a
// Cloudflare Turnstile challenge* (see the captured HAR), which only completes on
// Raspberry Pi's own page. So the user authenticates inside a WebView pointed at
// the real site, and WKWebView's persistent cookie store keeps the session across
// launches — exactly what the site requires ("keep the cookies/credentials").
//
// The device list, the remote desktop (GUI, WebRTC via turn*.raspberrypi.com) and
// the in-browser SSH terminal are all served by connect.raspberrypi.com itself, so
// we present them as authenticated WebViews wrapped in native chrome. Routes are
// centralised here so they are trivial to adjust if Connect changes them.

export const CONNECT_ORIGIN = 'https://connect.raspberrypi.com';
export const ID_ORIGIN = 'https://id.raspberrypi.com';

export const CONNECT_URLS = {
  /** Device list — the home after sign-in. Reaching it while signed-out
   *  redirects to /sign-in, so it doubles as the login entry point. */
  devices: `${CONNECT_ORIGIN}/devices`,
  /** Sign-in entry (kicks off id.raspberrypi.com OAuth). */
  signIn: `${CONNECT_ORIGIN}/sign-in`,
  /** Server-side sign-out. The chain of /auth/frontchannel-sign-out GETs seen in
   *  the HAR expires the session cookies via Set-Cookie. */
  signOut: `${CONNECT_ORIGIN}/sign-out`,
  /** Current-user probe used by the site. */
  me: `${ID_ORIGIN}/me.json`,
};

/** Live session pages under /devices/<id>. These are what Connect's own
 *  "Connect via → Screen sharing / Remote shell" buttons open (in a pop-up
 *  window on the website; here we load them directly, full screen). */
export const DEVICE_SCREEN_SUFFIX = '/screen-sharing-session';
export const DEVICE_SSH_SUFFIX = '/remote-shell-session';

export type ConnectAuth = 'unknown' | 'signedOut' | 'signedIn';

/**
 * Classify a WebView URL into an auth state.
 * - Any id.raspberrypi.com page, or connect .../sign-in, means signed-out
 *   (the OAuth login / Turnstile page is showing).
 * - A connect.raspberrypi.com page that is NOT the sign-in page means the
 *   session is live and the app UI (devices, a session) is showing.
 * CORS-free: we never fetch across origins, we only read the navigation URL.
 */
export function classifyUrl(url: string | undefined | null): ConnectAuth {
  if (!url) return 'unknown';
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.host;
    path = u.pathname;
  } catch {
    return 'unknown';
  }
  if (host.endsWith('id.raspberrypi.com')) return 'signedOut';
  if (host.endsWith('connect.raspberrypi.com')) {
    if (path.startsWith('/sign-in') || path.startsWith('/sign_in') || path.startsWith('/login')) {
      return 'signedOut';
    }
    if (path.startsWith('/auth/') || path.startsWith('/sign-out')) return 'unknown';
    return 'signedIn';
  }
  // challenges.cloudflare.com (Turnstile), gravatar, id-assets, etc. — mid-flow.
  return 'unknown';
}

/** True for hosts that belong to the Raspberry Pi sign-in / Connect experience
 *  and must stay inside our WebView. Everything else opens in the system browser. */
export function isConnectHost(url: string): boolean {
  try {
    const host = new URL(url).host;
    return (
      host.endsWith('raspberrypi.com') ||
      host.endsWith('challenges.cloudflare.com') ||
      host.endsWith('gravatar.com') ||
      host.endsWith('gstatic.com') ||
      host.endsWith('google.com') // Turnstile assets
    );
  } catch {
    return false;
  }
}

/** Injected once per page: reports the signed-in account (best-effort) and the
 *  device the user has opened, so the native chrome can show the email and a
 *  contextual title. Same-origin only, wrapped so it can never throw into the page. */
export const PROBE_JS = `
(function () {
  // Report in-page (Turbo / history) navigations too. After sign-in Connect can
  // move to /devices without a full page load, which never produces a settled
  // navigation event — so the pop-up wouldn't know login had succeeded.
  try {
    if (!window.__pimonHooked && window.ReactNativeWebView) {
      window.__pimonHooked = true;
      var post = function () {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'connect', href: location.href })); } catch (e) {}
      };
      ['pushState', 'replaceState'].forEach(function (k) {
        var orig = history[k];
        history[k] = function () { var r = orig.apply(this, arguments); setTimeout(post, 0); return r; };
      });
      window.addEventListener('popstate', post);
      document.addEventListener('turbo:load', post);
    }
  } catch (e) {}
  try {
    var payload = { type: 'connect', href: location.href };
    // Account email, if the page exposes it (data attr, meta, or a visible mailto).
    var el = document.querySelector('[data-user-email], meta[name="user-email"]');
    if (el) payload.email = el.getAttribute('content') || el.getAttribute('data-user-email');
    if (!payload.email) {
      var m = document.querySelector('a[href^="mailto:"]');
      if (m) payload.email = m.getAttribute('href').replace('mailto:', '');
    }
    // Device name when a single device page is open.
    var mDev = location.pathname.match(/\\/devices\\/([0-9a-f-]{8,})/i);
    if (mDev) {
      payload.deviceId = mDev[1];
      var h = document.querySelector('h1, [class*="deviceName"], [data-device-name]');
      if (h) payload.deviceName = (h.textContent || '').trim().slice(0, 60);
    }
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  } catch (e) {}
  true;
})();
`;

export interface ConnectProbe {
  type: 'connect';
  href: string;
  email?: string;
  deviceId?: string;
  deviceName?: string;
}

/** Set when the app goes signed-out on purpose (the user tapped Sign out, or the
 * check timed out offline) so we don't pop the sign-in page for it. Anything
 * else that signs us out means the session expired → reopen sign-in.
 * `manual` marks a sign-out the user asked for: the welcome screen then waits
 * for them to tap sign-in instead of opening it on its own. */
export const connectSignOutReason: { quiet: boolean; manual: boolean } = { quiet: false, manual: false };

/**
 * Injected into a live GUI/SSH session page to (1) hide Raspberry Pi Connect's
 * own toolbars/status so our chrome is the only chrome, (2) keep waiting until the
 * remote screen/terminal is actually ready, (3) forward keys from our keyboard,
 * (4) map a two-finger tap to a right-click, and (5) suppress the iOS soft
 * keyboard. Best-effort against Connect's page structure.
 */
export const SESSION_INJECT_JS = `
(function () {
  if (!window.ReactNativeWebView) return;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };

  // 1) Hide Connect's own chrome. The invisible keyboard input
  // (data-vnc-target="keyboardInput") is kept so __pimonSendKey can target it.
  var css = '.z-10.bg-white.flex-none{display:none!important}';
  var style = document.createElement('style');
  style.id = 'pimon-hide-connect-chrome';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  function hideStrips() {
    document.querySelectorAll('.z-10.bg-white.flex-none').forEach(function (el) {
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('border', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
      el.style.setProperty('background', 'transparent', 'important');
    });
  }
  hideStrips();
  var mo = new MutationObserver(function () { hideStrips(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // 2) Suppress the iOS soft keyboard: our own keyboard sends the keys, so mark
  // every text input readOnly. focus() then never pops the native keyboard, yet
  // synthetic key events still reach the page's listeners.
  function markReadonly(el) {
    if (el.getAttribute('data-pimon-kb')) return;
    el.setAttribute('data-pimon-kb', '1');
    el.setAttribute('readonly', 'readonly');
    el.setAttribute('inputmode', 'none');
  }
  function suppressKeyboard() {
    document.querySelectorAll('input, textarea').forEach(markReadonly);
  }
  suppressKeyboard();
  var active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) { try { active.blur(); } catch (e) {} }
  var kbMo = new MutationObserver(function () { suppressKeyboard(); });
  kbMo.observe(document.documentElement, { childList: true, subtree: true });

  // 3) Readiness: keep waiting while the "Waiting for response…" status is
  // present. Reveal only once that text is gone AND the screen/terminal is up.
  var done = false, tries = 0;
  function checkReady() {
    if (done) return;
    tries += 1;
    var statusEl = document.querySelector('[data-vnc-target="status"], [data-shell-target="status"]');
    var statusText = statusEl ? String(statusEl.textContent || '').trim() : '';

    // Failure: Connect reports it can't reach the device.
    if (/failed|error|disconnected|unable|denied|offline|timed out/i.test(statusText)) {
      done = true;
      post({ type: 'session-error', message: statusText });
      return;
    }

    var screenOk = false;
    var els = [document.querySelector('canvas'), document.querySelector('video'),
               document.querySelector('.xterm'), document.querySelector('textarea.xterm-helper-textarea')];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (r.width >= 80 && r.height >= 40) { screenOk = true; break; }
    }

    // The "Waiting for response…" line is gone (or replaced) → the session is up.
    var waiting = /waiting|connecting/i.test(statusText);
    if (!waiting && screenOk) {
      done = true;
      post({ type: 'session-ready' });
      return;
    }

    if (tries >= 80) {
      done = true;
      var msg = statusText && !/waiting/i.test(statusText) ? statusText : 'Timed out connecting to the device';
      post({ type: 'session-error', message: msg });
      return;
    }
    setTimeout(checkReady, 250);
  }
  setTimeout(checkReady, 300);

  // 4) Send a key (optionally Ctrl/Alt/Shift/Super+key) into the session.
  window.__pimonSendKey = function (key) {
    var t = document.querySelector('textarea.xterm-helper-textarea') ||
            document.querySelector('textarea[data-vnc-target="keyboardInput"]') ||
            document.querySelector('textarea');
    if (!t) return false;
    t.focus();
    var parts = String(key).split('+');
    var base = parts.pop();
    var mods = parts;
    var NORM = {
      'Return': 'Enter', 'Enter': 'Enter',
      'BackSpace': 'Backspace', 'Backspace': 'Backspace',
      'Esc': 'Escape', 'Escape': 'Escape',
      'Caps_Lock': 'CapsLock', 'CapsLock': 'CapsLock',
      'Left': 'ArrowLeft', 'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Right': 'ArrowRight',
      'ArrowLeft': 'ArrowLeft', 'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown', 'ArrowRight': 'ArrowRight',
      'Tab': 'Tab', 'Delete': 'Delete', ' ': ' '
    };
    var k = NORM[base] !== undefined ? NORM[base] : base;
    var KC = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46,
      ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, ' ': 32 };
    var keyCode = KC[k] !== undefined ? KC[k] : (k && k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
    var ctrl = mods.indexOf('Ctrl') >= 0;
    var alt = mods.indexOf('Alt') >= 0;
    var shift = mods.indexOf('Shift') >= 0;
    var meta = mods.indexOf('Super') >= 0;
    function dispatch(type) {
      var ev = new KeyboardEvent(type, { key: k, code: k, bubbles: true, cancelable: true, ctrlKey: ctrl, altKey: alt, shiftKey: shift, metaKey: meta });
      try {
        Object.defineProperty(ev, 'keyCode', { get: function () { return keyCode; } });
        Object.defineProperty(ev, 'which', { get: function () { return keyCode; } });
      } catch (e) {}
      t.dispatchEvent(ev);
    }
    dispatch('keydown');
    dispatch('keyup');
    return true;
  };

  // 5) Two-finger tap → right-click (fires a contextmenu event on the tapped element).
  var tf = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      tf = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2, t: Date.now() };
    } else { tf = null; }
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!tf) return;
    var was = tf; tf = null;
    if (Date.now() - was.t > 350) return;
    var el = document.elementFromPoint(was.x, was.y) || document.body;
    try {
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: was.x, clientY: was.y, button: 2 }));
    } catch (err) {}
  }, { passive: true });
})();
true;
`;

/** Injected BEFORE the session page renders (early) so Connect's toolbars never
 *  flash on screen. Same selectors as SESSION_INJECT_JS's hiding CSS. */
export const SESSION_CHROME_JS = `
(function () {
  // 1) Collapse Connect's header + footer toolbars. We collapse (not display:none)
  // so the fixed keyboardInput textarea inside the footer stays functional — our
  // keyboard types through it, exactly like the page itself does.
  var css = '.z-10.bg-white.flex-none{height:0!important;min-height:0!important;padding:0!important;border:0!important;background:transparent!important} ' +
    '.z-10.bg-white.flex-none :not(textarea){display:none!important}';
  var s = document.createElement('style');
  s.id = 'pimon-chrome-css';
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  // Connect's own keyboard field (focused when the remote screen is tapped) is a
  // plain <textarea>, and iOS Safari auto-capitalises / autocorrects those — so a
  // lowercase "s" reached the Pi as "S". Turn all of that off, now and for any
  // field the page adds later.
  function plainTyping(el) {
    if (el.getAttribute('data-pimon-plain')) return;
    el.setAttribute('data-pimon-plain', '1');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('spellcheck', 'false');
  }
  function plainAll() { document.querySelectorAll('textarea, input').forEach(plainTyping); }
  if (document.documentElement) {
    plainAll();
    new MutationObserver(plainAll).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', plainAll);

  if (!window.ReactNativeWebView) return;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };

  // 2) Send a key the same way the page does: keydown for special keys, input
  // for printable characters — both land on Connect's keyboardInput textarea and
  // are forwarded to the Pi by the vnc controller.
  window.__pimonSendKey = function (key) {
    var t = document.querySelector('textarea.xterm-helper-textarea') ||
            document.querySelector('textarea[data-vnc-target="keyboardInput"]') ||
            document.querySelector('textarea');
    if (!t) return false;
    t.focus();
    var parts = String(key).split('+');
    var base = parts.pop();
    var mods = parts;
    var NORM = {
      'Return': 'Enter', 'Enter': 'Enter',
      'BackSpace': 'Backspace', 'Backspace': 'Backspace',
      'Esc': 'Escape', 'Escape': 'Escape',
      'Caps_Lock': 'CapsLock', 'CapsLock': 'CapsLock',
      'Left': 'ArrowLeft', 'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Right': 'ArrowRight',
      'ArrowLeft': 'ArrowLeft', 'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown', 'ArrowRight': 'ArrowRight',
      'Tab': 'Tab', 'Delete': 'Delete', ' ': ' '
    };
    var k = NORM[base] !== undefined ? NORM[base] : base;
    var ctrl = mods.indexOf('Ctrl') >= 0;
    var alt = mods.indexOf('Alt') >= 0;
    var shift = mods.indexOf('Shift') >= 0;
    var meta = mods.indexOf('Super') >= 0;

    function codeFor(ch) {
      if (/^[a-zA-Z]$/.test(ch)) return 'Key' + ch.toUpperCase();
      if (/^[0-9]$/.test(ch)) return 'Digit' + ch;
      var C = { ' ': 'Space', 'Enter': 'Enter', 'Backspace': 'Backspace', 'Tab': 'Tab', 'Escape': 'Escape',
        'ArrowLeft': 'ArrowLeft', 'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown', 'ArrowRight': 'ArrowRight',
        '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\\\': 'Backslash',
        ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash' };
      return C[ch] || ch;
    }

    // Keydown/keyup for every key (printable + special) — the same way noVNC and
    // Connect's viewer read keyboard input (e.key → keysym, e.code → keycode).
    var KC = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46,
      ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, ' ': 32 };
    var keyCode = KC[k] !== undefined ? KC[k] : (k && k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
    function dispatch(type) {
      var ev = new KeyboardEvent(type, { key: k, code: codeFor(k), bubbles: true, cancelable: true, ctrlKey: ctrl, altKey: alt, shiftKey: shift, metaKey: meta });
      try {
        Object.defineProperty(ev, 'keyCode', { get: function () { return keyCode; } });
        Object.defineProperty(ev, 'which', { get: function () { return keyCode; } });
      } catch (e) {}
      t.dispatchEvent(ev);
    }
    dispatch('keydown');
    dispatch('keyup');
    return true;
  };

  // 3) Insert printable text the same way the native keyboard would: APPEND it
  // to the field and fire an "input" event. Connect's handler diffs the field
  // against its previous value and sends only what changed (each character as
  // its exact keysym, so case is kept). Replacing the whole value instead read
  // as "delete everything, type this", sending stray Backspaces.
  window.__pimonInsertText = function (text) {
    var t = document.querySelector('textarea[data-vnc-target="keyboardInput"]') ||
            document.querySelector('textarea.xterm-helper-textarea') ||
            document.querySelector('textarea');
    if (!t) return false;
    var s = String(text);
    t.value = t.value + s;
    try { t.setSelectionRange(t.value.length, t.value.length); } catch (e) {}
    var ev;
    try {
      ev = new InputEvent('input', { data: s, inputType: 'insertText', bubbles: true, cancelable: true, composed: true });
    } catch (e) {
      ev = new Event('input', { bubbles: true, cancelable: true });
    }
    t.dispatchEvent(ev);
    return true;
  };

  // 4) Report when the remote screen is actually ready. The waiting screen stays
  // up until then, covering Connect's page so nothing white flashes through.
  var done = false, tries = 0;
  function checkReady() {
    if (done) return;
    tries += 1;
    var statusEl = document.querySelector('[data-vnc-target="status"], [data-shell-target="status"]');
    // Connect HIDES the status line once a session opens but leaves its text
    // ("Waiting for response from …") in place — the remote shell does exactly
    // this — so only a visible status line counts as still waiting.
    var statusShown = !!statusEl && !statusEl.classList.contains('hidden') && statusEl.getClientRects().length > 0;
    var statusText = statusShown ? String(statusEl.textContent || '').trim() : '';
    var waiting = /waiting|connecting/i.test(statusText);
    var screen = document.querySelector('[data-vnc-target="screen"] canvas, video, .xterm');
    var screenOk = false;
    if (screen) {
      var r = screen.getBoundingClientRect();
      screenOk = r.width >= 80 && r.height >= 40;
    }
    if (!waiting && screenOk) { done = true; post({ type: 'session-ready' }); return; }
    if (tries >= 160) { done = true; post({ type: 'session-error', message: 'Timed out connecting to the device' }); return; }
    setTimeout(checkReady, 250);
  }
  setTimeout(checkReady, 300);

  // 5) Hide whichever keyboard is up — ours or the one Connect's field raised.
  window.__pimonHideKeyboard = function () {
    try { var a = document.activeElement; if (a && a.blur) a.blur(); } catch (e) {}
  };
})();
true;
`;

/**
 * Injected BEFORE Connect's remote-shell page runs (hidden Monitor session).
 * Connect's shell is a WebRTC data channel labelled "shell" carrying raw
 * terminal bytes both ways. We keep a handle on it to type commands, and read
 * each command's output back between numbered markers. The markers are printed
 * by `printf '@@PM_B%s@@' <n>`, so the shell echoing the typed line (which
 * shows `%s`, not the number) can never be mistaken for the output.
 */
export const CONNECT_SHELL_JS = `
(function () {
  if (window.__pimonShellHooked) return;
  window.__pimonShellHooked = true;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var PC = window.RTCPeerConnection;
  if (!PC || !PC.prototype.createDataChannel) { post({ type: 'shell-error', message: 'no-webrtc' }); return; }
  var ESC = /\\x1b\\[[0-9;?]*[ -\\/]*[@-~]|\\x1b\\][^\\x07\\x1b]*(\\x07|\\x1b\\\\)|\\x1b[()][A-Za-z0-9]|\\x1b[=>]/g;
  var buf = '';
  function scan() {
    for (;;) {
      var b = /@@PM_B(\\d+)@@/.exec(buf);
      if (!b) { if (buf.length > 200000) buf = buf.slice(-2000); return; }
      var endTok = '@@PM_E' + b[1] + '@@';
      var e = buf.indexOf(endTok, b.index);
      if (e < 0) return;
      var out = buf.slice(b.index + b[0].length, e);
      buf = buf.slice(e + endTok.length);
      out = out.replace(ESC, '').replace(/\\r/g, '').replace(/^\\n/, '');
      post({ type: 'shell-result', id: Number(b[1]), out: out });
    }
  }
  var orig = PC.prototype.createDataChannel;
  PC.prototype.createDataChannel = function (label) {
    var ch = orig.apply(this, arguments);
    if (label === 'shell') {
      window.__pimonShell = ch;
      try { ch.binaryType = 'arraybuffer'; } catch (e) {}
      var dec = new TextDecoder();
      ch.addEventListener('open', function () { post({ type: 'shell-open' }); });
      ch.addEventListener('close', function () { post({ type: 'shell-closed' }); });
      ch.addEventListener('message', function (ev) {
        var d = ev.data;
        buf += typeof d === 'string' ? d : dec.decode(new Uint8Array(d), { stream: true });
        scan();
      });
    }
    return ch;
  };
  window.__pimonShellSend = function (text) {
    var ch = window.__pimonShell;
    if (!ch || ch.readyState !== 'open') return false;
    ch.send(text);
    return true;
  };
})();
true;
`;

/** Injected on demand in a live desktop session: posts a small JPEG of the
 *  remote screen (Connect draws it on a canvas, or plays it in a <video>) so the
 *  device card can show where the user left off. */
export const SNAPSHOT_JS = `
(function () {
  try {
    var c = document.querySelector('[data-vnc-target="screen"] canvas') || document.querySelector('canvas');
    var v = document.querySelector('video');
    var src = c && c.width > 50 && c.height > 50 ? c : (v && v.videoWidth > 50 ? v : null);
    if (!src || !window.ReactNativeWebView) return;
    var w = src.videoWidth || src.width, h = src.videoHeight || src.height;
    var W = Math.min(720, w), H = Math.round(h * W / w);
    var o = document.createElement('canvas');
    o.width = W; o.height = H;
    o.getContext('2d').drawImage(src, 0, 0, W, H);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'snapshot', data: o.toDataURL('image/jpeg', 0.7) }));
  } catch (e) {}
})();
true;
`;
