import { latinDigits } from '../lib/latinDigits';

describe('latinDigits', () => {
  it('turns Arabic-Indic digits and the Arabic decimal point into an IP', () => {
    expect(latinDigits('١٩٢٫١٦٨٫١٠٠٫١٧٩')).toBe('192.168.100.179');
  });
  it('handles Persian digits and leaves ASCII untouched', () => {
    expect(latinDigits('۲۲')).toBe('22');
    expect(latinDigits('kali.local:22')).toBe('kali.local:22');
  });
});
