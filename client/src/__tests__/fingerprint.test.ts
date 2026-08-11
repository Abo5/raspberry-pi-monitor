// Fingerprint representations (docs/13 §7.12): hex grouped in 4s, six words.
import { hexGroups, randomHex, wordsFromHex } from '../lib/fingerprint';

describe('hexGroups', () => {
  it('groups 32 chars into 8 groups of 4, uppercased', () => {
    const groups = hexGroups('9f2c4a81d30e77b51ce488026bafd915');
    expect(groups).toHaveLength(8);
    expect(groups[0]).toBe('9F2C');
    expect(groups.every((g) => g.length === 4)).toBe(true);
  });
});

describe('wordsFromHex', () => {
  it('produces exactly six words', () =>
    expect(wordsFromHex('9F2C4A81D30E77B51CE488026BAFD915')).toHaveLength(6));
  it('is deterministic — same key, same words (the whole point of the ceremony)', () => {
    const hex = 'AABBCCDDEEFF00112233445566778899';
    expect(wordsFromHex(hex)).toEqual(wordsFromHex(hex));
  });
  it('differs for a different key', () => {
    expect(wordsFromHex('00000000000000000000000000000000')).not.toEqual(
      wordsFromHex('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
    );
  });
});

describe('randomHex', () => {
  it('emits the requested length from the hex alphabet', () => {
    const hex = randomHex(32);
    expect(hex).toHaveLength(32);
    expect(hex).toMatch(/^[0-9A-F]{32}$/);
  });
});
