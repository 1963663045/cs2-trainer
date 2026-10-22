import { describe, expect, it } from 'vitest';
import { candidates, initPsa, isDone, pickAB, pickSide, psaResult } from './psa';

const fixed = (v: number) => () => v;

describe('PSA 区间逻辑', () => {
  it('初始区间以 base 为中心', () => {
    const s = initPsa(2, 0.5, 7, fixed(0.1));
    expect(s.lo).toBeCloseTo(1, 9);
    expect(s.hi).toBeCloseTo(3, 9);
    expect(candidates(s)).toEqual({ a: s.lo, b: s.hi });
  });
  it('每轮区间减半，7 轮后结束', () => {
    let s = initPsa(2, 0.5, 7, fixed(0.9));
    const w0 = s.hi - s.lo;
    for (let i = 0; i < 7; i++) s = pickSide(s, i % 2 ? 'low' : 'high', fixed(0.3));
    expect(isDone(s)).toBe(true);
    expect(s.hi - s.lo).toBeCloseTo(w0 / 128, 9);
    expect(s.history.length).toBe(7);
    expect(pickSide(s, 'low')).toBe(s);
  });
  it('一直选高 → 收敛到上界附近；一直选低 → 下界附近', () => {
    let hi = initPsa(1, 0.5, 7);
    let lo = initPsa(1, 0.5, 7);
    for (let i = 0; i < 7; i++) {
      hi = pickSide(hi, 'high');
      lo = pickSide(lo, 'low');
    }
    expect(psaResult(hi)).toBeGreaterThan(1.49);
    expect(psaResult(lo)).toBeLessThan(0.51);
  });
  it('盲测 A/B 映射正确', () => {
    const s = initPsa(1, 0.5, 7, fixed(0.9)); // aIsLow=false → A 是高
    const n = pickAB(s, 'A');
    expect(n.history[0].picked).toBe('high');
    expect(n.lo).toBeCloseTo(1, 9);
  });
});
