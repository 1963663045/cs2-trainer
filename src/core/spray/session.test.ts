import { describe, expect, it } from 'vitest';
import { SpraySession } from './session';

describe('SpraySession', () => {
  it('按射击间隔计数，第一发在按下瞬间，最多一个弹匣', () => {
    const s = new SpraySession(0.1, 30);
    s.start(1000);
    expect(s.shotsAt(1000)).toBe(1);
    expect(s.shotsAt(1099)).toBe(1);
    expect(s.shotsAt(1100)).toBe(2);
    expect(s.shotsAt(9999)).toBe(30);
    expect(s.isEmpty(3999)).toBe(false);
    expect(s.isEmpty(4000)).toBe(true);
  });
  it('松开后按松开时刻统计并在发射时刻采样', () => {
    const s = new SpraySession(0.1, 30);
    s.start(0);
    s.push({ t: 50, dx: 0, dy: 100 });
    s.push({ t: 150, dx: 0, dy: 100 });
    s.stop(250);
    const r = s.result(0.022);
    expect(r.shots).toBe(3);
    expect(r.viewAtShots[0].y).toBeCloseTo(0, 9);
    expect(r.viewAtShots[2].y).toBeCloseTo(-4.4, 9);
  });
});
