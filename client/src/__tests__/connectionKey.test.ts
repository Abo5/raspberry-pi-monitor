import { decodeKey } from '../lib/connectionKey';

// An example key as printed by the Pi installer: base64 of
// {"name":"pi","ip":"192.168.1.50","port":"8443","token":"SAMPLE7KEY4TESTZ8QWERTY2"}
const KEY =
  'eyJuYW1lIjoicGkiLCJpcCI6IjE5Mi4xNjguMS41MCIsInBvcnQiOiI4NDQzIiwidG9rZW4iOiJTQU1QTEU3S0VZNFRFU1RaOFFXRVJUWTIifQ==';

describe('decodeKey', () => {
  it('decodes the base64 installer key', () => {
    expect(decodeKey(KEY)).toMatchObject({
      ip: '192.168.1.50',
      port: '8443',
      token: 'SAMPLE7KEY4TESTZ8QWERTY2',
    });
  });

  it('accepts raw JSON (the QR payload)', () => {
    const json = JSON.stringify({ ip: '10.0.0.5', port: '8443', token: 'ABCD2345EFGH6789JKLM' });
    expect(decodeKey(json)).toMatchObject({ ip: '10.0.0.5', token: 'ABCD2345EFGH6789JKLM' });
  });

  it('trims surrounding whitespace/newlines', () => {
    expect(decodeKey(`  ${KEY}\n`)).toMatchObject({ ip: '192.168.1.50' });
  });

  it('rejects garbage', () => {
    expect(decodeKey('hello world')).toBeNull();
    expect(decodeKey('')).toBeNull();
  });

  it('rejects JSON missing required fields', () => {
    expect(decodeKey(JSON.stringify({ ip: '1.2.3.4' }))).toBeNull();
  });
});
