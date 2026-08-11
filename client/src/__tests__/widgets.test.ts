// Widget catalog integrity (the gallery renders these by id).
import { CATALOG, FAMILY_META, WidgetFamily } from '../widgets/designs';

const FAMILIES: WidgetFamily[] = ['small', 'medium', 'circular', 'rectangular', 'inline'];

describe('widget catalog', () => {
  it('has unique ids', () => {
    const ids = CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a rich set (30+ designs)', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it('every design has a known family and a name', () => {
    for (const d of CATALOG) {
      expect(FAMILIES).toContain(d.family);
      expect(d.name.length).toBeGreaterThan(0);
    }
  });

  it('covers every WidgetKit family', () => {
    for (const f of FAMILIES) {
      expect(CATALOG.some((d) => d.family === f)).toBe(true);
    }
  });

  it('every family has display metadata with positive dimensions', () => {
    for (const f of FAMILIES) {
      const m = FAMILY_META[f];
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.w).toBeGreaterThan(0);
      expect(m.h).toBeGreaterThan(0);
    }
  });

  it('offers both Home Screen and Lock Screen families', () => {
    const home = CATALOG.filter((d) => d.family === 'small' || d.family === 'medium');
    const lock = CATALOG.filter((d) => ['circular', 'rectangular', 'inline'].includes(d.family));
    expect(home.length).toBeGreaterThan(0);
    expect(lock.length).toBeGreaterThan(0);
  });
});
