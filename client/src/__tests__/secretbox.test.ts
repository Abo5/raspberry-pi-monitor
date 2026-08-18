import { deriveKey, seal, open, utf8ToBytes, bytesToUtf8, NONCE_LEN } from '../lib/secretbox';

function hex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

describe('secretbox (must match the Rust agent byte-for-byte)', () => {
  it('produces the exact cross-language vector from crypto.rs', () => {
    // Rust: derive_key("testtoken"), nonce = 0x01*24, seal("hello")
    const key = deriveKey('testtoken');
    const nonce = new Uint8Array(NONCE_LEN).fill(1);
    const blob = seal(key, nonce, utf8ToBytes('hello'));
    expect(hex(blob)).toBe(
      '010101010101010101010101010101010101010101010101e71ab32a6d93cc1197c37a13d13ca3e55a23f66c91',
    );
  });

  it('round-trips a JSON message', () => {
    const key = deriveKey('SAMPLE7KEY4TESTZ8QWERTY2');
    const nonce = new Uint8Array(NONCE_LEN).fill(7);
    const msg = JSON.stringify({ 'cpu.temp_c': 50.7 });
    const blob = seal(key, nonce, utf8ToBytes(msg));
    expect(bytesToUtf8(open(key, blob)!)).toBe(msg);
  });

  it('rejects tampered ciphertext', () => {
    const key = deriveKey('SAMPLE7KEY4TESTZ8QWERTY2');
    const nonce = new Uint8Array(NONCE_LEN).fill(7);
    const blob = seal(key, nonce, utf8ToBytes('hello'));
    blob[blob.length - 1] ^= 0x01;
    expect(open(key, blob)).toBeNull();
  });

  it('rejects the wrong key', () => {
    const nonce = new Uint8Array(NONCE_LEN).fill(7);
    const blob = seal(deriveKey('right'), nonce, utf8ToBytes('hello'));
    expect(open(deriveKey('wrong'), blob)).toBeNull();
  });
});
