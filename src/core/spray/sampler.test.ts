import { describe, expect, it } from 'vitest';
import { buildPath, sampleAt, sampleShots, shotTimes } from './sampler';

describe('sampler', () => {
  it('shotTimes 连续计时', () => {
    expect(shotTimes(0.1, 4)).toEqual([0, 100, 200, 300]);
  });
  it('buildPath: 下拉鼠标 = 视角向下(y 为负)', () => {
    const p = buildPath(
      [
        { t: 1010, dx: 10, dy: 20 },
        { t: 1020, dx: 0, dy: 20 }
      ],
      1000,
      0.022
    );
    expect(p.at(-1)!.x).toBeCloseTo(0.22, 6);
    expect(p.at(-1)!.y).toBeCloseTo(-0.88, 6);
  });
  it('线性插值与边界', () => {
    const path = [
      { t: 0, x: 0, y: 0 },
      { t: 100, x: 1, y: -2 }
    ];
    expect(sampleAt(path, 50)).toEqual({ x: 0.5, y: -1 });
    expect(sampleAt(path, 500)).toEqual({ x: 1, y: -2 });
    expect(sampleShots(path, [0, 100]).length).toBe(2);
  });
});
