// A single "connection key" the Agent's installer prints. It's base64 of
// {name,ip,port,token}. The user pastes one string instead of three fields,
// or scans a QR that carries the same JSON. decodeKey accepts any of:
//   • the base64 key                (installer output)
//   • the raw JSON  {ip,port,token} (Agent's QR payload)
export interface Endpoint {
  ip: string;
  port: string;
  token: string;
  name?: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Minimal base64 → string (no atob dependency; Hermes-safe).
function base64Decode(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  let bs = 0;
  let bc = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = B64.indexOf(str.charAt(i));
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
}

function fromParsed(v: unknown): Endpoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.ip == null || o.port == null || o.token == null) return null;
  return {
    ip: String(o.ip).trim(),
    port: String(o.port).trim(),
    token: String(o.token).trim(),
    name: o.name != null ? String(o.name) : undefined,
  };
}

/** Parse a pasted key or a scanned QR payload into an endpoint, or null. */
export function decodeKey(raw: string): Endpoint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // 1) raw JSON (the QR payload)
  try {
    return fromParsed(JSON.parse(trimmed));
  } catch {
    // not JSON — try base64 below
  }
  // 2) base64 of JSON (the installer key)
  try {
    return fromParsed(JSON.parse(base64Decode(trimmed)));
  } catch {
    return null;
  }
}
