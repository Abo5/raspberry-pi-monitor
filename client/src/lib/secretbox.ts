// Application-layer authenticated encryption for the agent ⇄ app channel.
// Mirrors the Rust `crypto.rs` in raspberry-pi-tool exactly:
//   key   = SHA-512("rpi-v1|" + token)[..32]   (nacl.hash is SHA-512)
//   blob  = nonce(24) || secretbox(plaintext, nonce, key)   (XSalsa20-Poly1305)
// The token never travels on the wire; being able to open a blob proves you hold
// the key. This gives TLS-grade confidentiality + tamper-proofing without needing
// the platform to trust a self-signed LAN certificate.
import nacl from 'tweetnacl';

export const NONCE_LEN = nacl.secretbox.nonceLength; // 24

// UTF-8 helpers that don't depend on TextEncoder (Hermes-safe).
export function utf8ToBytes(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      // surrogate pair
      const c2 = s.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return Uint8Array.from(out);
}

export function bytesToUtf8(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f));
    else {
      const cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      const u = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return s;
}

/** K = SHA-512("rpi-v1|" + token)[..32] */
export function deriveKey(token: string): Uint8Array {
  const full = nacl.hash(utf8ToBytes('rpi-v1|' + token)); // 64 bytes (SHA-512)
  return full.slice(0, 32);
}

/** Seal bytes with an explicit nonce → nonce || ciphertext. */
export function seal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const ct = nacl.secretbox(plaintext, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

/** Open nonce || ciphertext → plaintext, or null on tamper / wrong key. */
export function open(key: Uint8Array, blob: Uint8Array): Uint8Array | null {
  if (blob.length < NONCE_LEN + nacl.secretbox.overheadLength) return null;
  const nonce = blob.slice(0, NONCE_LEN);
  const ct = blob.slice(NONCE_LEN);
  return nacl.secretbox.open(ct, nonce, key);
}

/** A fresh random nonce. Requires a CSPRNG (see note in transport wiring). */
export function randomNonce(): Uint8Array {
  return nacl.randomBytes(NONCE_LEN);
}

// Convenience string wrappers.
export function sealString(key: Uint8Array, plaintext: string): Uint8Array {
  return seal(key, randomNonce(), utf8ToBytes(plaintext));
}
export function openToString(key: Uint8Array, blob: Uint8Array): string | null {
  const pt = open(key, blob);
  return pt ? bytesToUtf8(pt) : null;
}
