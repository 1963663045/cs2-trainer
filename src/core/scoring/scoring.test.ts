import { describe, expect, it } from 'vitest';
import { scoreSpray } from './index';

const pattern = Array.from({ length: 12 }, (_, i) => ({ shot: i + 1, x: i * 0.1, y: i * 0.5 }));
const opts = { dpi: 800, sens: 1, yaw: 0.022, toleranceDeg: 1 };

describe('scoreSpray', () => {
  it('完美补偿得 100 分', () => {
    const view = pattern.map((p) => ({ x: -p.x, y: -p.y }));
    const r = scoreSpray(pattern, view, opts);
    expect(r.total).toBe(100);
    expect(r.first10).toBe(100);
    expect(r.meanErrDeg).toBeCloseTo(0, 9);
  });
  it('不压枪时误差等于弹道偏移，且换算厘米', () => {
    const view = pattern.map(() => ({ x: 0, y: 0 }));
    const r = scoreSpray(pattern, view, opts);
    expect(r.shots[2].errDeg).toBeCloseTo(Math.hypot(0.2, 1.0), 9);
    expect(r.shots[2].errCm).toBeCloseTo((Math.hypot(0.2, 1.0) / 0.022 / 800) * 2.54, 9);
    expect(r.shots[11].score).toBe(0);
    expect(r.total).toBeLessThan(r.first10 + 1);
  });
  it('最差片段定位', () => {
    const view = pattern.map((p, i) => (i >= 6 && i <= 10 ? { x: 0, y: 0 } : { x: -p.x, y: -p.y }));
    const r = scoreSpray(pattern, view, { ...opts, segmentSize: 5 });
    expect(r.worstSegment).toMatchObject({ from: 7, to: 11 });
  });
  it('首 10 发只统计前 10 发', () => {
    const view = pattern.map((p, i) => (i < 10 ? { x: -p.x, y: -p.y } : { x: 5, y: 5 }));
    const r = scoreSpray(pattern, view, opts);
    expect(r.first10).toBe(100);
    expect(r.total).toBeLessThan(100);
  });
});
