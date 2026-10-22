import { describe, expect, it } from 'vitest';
import { decayedIndex, patternSlice, recoveryTimeFor } from './recovery';

// AK-47 的 vdata 参数
const ak = {
  RecoveryTimeStand: 0.368,
  RecoveryTimeStandFinal: 0.506,
  RecoveryTimeCrouch: 0.305257,
  RecoveryTimeCrouchFinal: 0.419728,
  RecoveryTransitionStartBullet: 2,
  RecoveryTransitionEndBullet: 5
};

describe('recovery（近似）', () => {
  it('恢复时间在过渡区间线性插值', () => {
    expect(recoveryTimeFor(ak, 1)).toBeCloseTo(0.368, 6);
    expect(recoveryTimeFor(ak, 2)).toBeCloseTo(0.368, 6);
    expect(recoveryTimeFor(ak, 5)).toBeCloseTo(0.506, 6);
    expect(recoveryTimeFor(ak, 20)).toBeCloseTo(0.506, 6);
    expect(recoveryTimeFor(ak, 3.5)).toBeCloseTo((0.368 + 0.506) / 2, 6);
    expect(recoveryTimeFor(ak, 5, true)).toBeCloseTo(0.419728, 6);
  });
  it('序号随停火时间线性衰减到 0', () => {
    expect(decayedIndex(10, 0, ak)).toBe(10);
    expect(decayedIndex(10, 0.253, ak)).toBe(5);
    expect(decayedIndex(10, 0.506, ak)).toBe(0);
    expect(decayedIndex(10, 5, ak)).toBe(0);
    expect(decayedIndex(0, 0.1, ak)).toBe(0);
  });
  it('参数缺失视为完全恢复', () => {
    expect(decayedIndex(10, 0.01, {})).toBe(0);
  });
});

describe('patternSlice', () => {
  const pat = [0, 1, 2, 3].map((i) => ({ shot: i + 1, x: i * 0.5, y: i }));
  it('start=0 原样截取', () => expect(patternSlice(pat, 0, 2)).toEqual(pat.slice(0, 2)));
  it('从中间开始时归零', () =>
    expect(patternSlice(pat, 2, 5)).toEqual([
      { shot: 1, x: 0, y: 0 },
      { shot: 2, x: 0.5, y: 1 }
    ]));
});
