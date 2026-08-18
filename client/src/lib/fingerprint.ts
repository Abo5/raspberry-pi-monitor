// Fingerprint representations (docs/04-SECURITY-E2EE.md, 13-DESIGN-SYSTEM §7.12):
// a 32-hex-char block grouped in 4s, plus a six-word sequence readable aloud.

const WORDS = [
  'anchor', 'velvet', 'piston', 'marina', 'cobalt', 'thistle', 'lantern', 'quartz',
  'meadow', 'harbor', 'ember', 'walnut', 'falcon', 'ingot', 'juniper', 'krypton',
  'lagoon', 'magnet', 'nickel', 'orchid', 'pebble', 'quiver', 'russet', 'saffron',
  'timber', 'umbra', 'vertex', 'willow', 'xenon', 'yarrow', 'zephyr', 'basalt',
];

export function hexGroups(hex: string): string[] {
  const groups: string[] = [];
  for (let i = 0; i < hex.length; i += 4) groups.push(hex.slice(i, i + 4).toUpperCase());
  return groups;
}

export function wordsFromHex(hex: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const nibblePair = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    out.push(WORDS[nibblePair % WORDS.length]);
  }
  return out;
}

export function randomHex(len = 32): string {
  let s = '';
  const chars = '0123456789ABCDEF';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}
