import { describe, expect, it, vi } from 'vitest';

// settings.ts 会创建持久化 store：给一个最小 localStorage
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const { sanitizeSettings } = await import('../store/settings');
const { scoreSpray } = await import('./scoring');
const { buildTrend, weaponsIn } = await import('./replay/trend');
const { buildPath, sampleAt, sampleShots, shotTimes } = await import('./spray/sampler');
const { decayedIndex } = await import('./spray/recovery');
const { SpraySession } = await import('./spray/session');
const { validateWeapon } = await import('./weapons');
const { pxPerDegForHeight, toPx, viewFor } = await import('../render/sprayCanvas');

describe('sanitizeSettings', () => {
  it('丢弃非法值，保留合法值', () => {
    expect(sanitizeSettings({ dpi: 0, sens: 'x', mYaw: 0.022, aspect: '21:9', showGuide: 'yes', toleranceDeg: 2 })).toEqual({ mYaw: 0.022, toleranceDeg: 2 });
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings({ sens: NaN, dpi: -800 })).toEqual({});
    expect(sanitizeSettings({ aspect: '4:3-stretched', configured: true })).toEqual({ aspect: '4:3-stretched', configured: true });
  });
});

describe('空数据', () => {
  it('评分：空弹道 / 空视角', () => {
    const r = scoreSpray([], [], { dpi: 800, sens: 1, yaw: 0.022 });
    expect(r.total).toBe(0);
    expect(r.shots).toEqual([]);
    expect(r.worstSegment).toBeNull();
    expect(scoreSpray([{ shot: 1, x: 0, y: 0 }], [], { dpi: 800, sens: 1, yaw: 0.022 }).shots).toEqual([]);
  });
  it('评分：发数少于片段窗口时无最差片段；误差超过容差得 0 分', () => {
    const r = scoreSpray([{ shot: 1, x: 0, y: 5 }], [{ x: 0, y: 0 }], { dpi: 800, sens: 1, yaw: 0.022, toleranceDeg: 1 });
    expect(r.worstSegment).toBeNull();
    expect(r.shots[0].score).toBe(0);
  });
  it('趋势：空记录', () => {
    expect(buildTrend([])).toEqual({ real: [], demo: [], unscored: 0 });
    expect(weaponsIn([])).toEqual([]);
  });
  it('采样：无移动时路径只有原点，任意时刻都为 0', () => {
    const p = buildPath([], 0, 0.022);
    expect(p).toEqual([{ t: 0, x: 0, y: 0 }]);
    expect(sampleAt(p, 500)).toEqual({ x: 0, y: 0 });
    expect(sampleAt([], 5)).toEqual({ x: 0, y: 0 });
    expect(shotTimes(0.1, 0)).toEqual([]);
    expect(sampleShots(p, [])).toEqual([]);
  });
  it('采样：开火前的移动被忽略；同一时刻多个事件不产生除零', () => {
    const p = buildPath([{ t: 5, dx: 100, dy: 0 }, { t: 10, dx: 10, dy: 0 }, { t: 10, dx: 10, dy: 0 }], 10, 0.1);
    expect(p.at(-1)!.x).toBeCloseTo(2, 9);
    expect(Number.isFinite(sampleAt(p, 0.5).x)).toBe(true);
  });
});

describe('恢复近似边界', () => {
  it('负的停火时长不会让序号变大；NaN 视为完全恢复', () => {
    const rec = { RecoveryTimeStand: 0.4, RecoveryTimeStandFinal: 0.4 };
    expect(decayedIndex(10, -1, rec)).toBe(10);
    expect(decayedIndex(10, NaN, rec)).toBe(0);
    expect(decayedIndex(NaN, 0.1, rec)).toBe(0);
  });
  it('起始序号被限制在弹匣内', () => {
    const s = new SpraySession(0.1, 30);
    s.start(0, 99);
    expect(s.startIndex).toBe(29);
    expect(s.maxShots).toBe(1);
    s.start(0, -5);
    expect(s.startIndex).toBe(0);
  });
});

describe('武器数据校验', () => {
  const ok = { id: 'x', name: 'X', cycleTime: 0.1, clipSize: 30, perBullet: [] };
  it('合法数据通过', () => expect(validateWeapon(ok).isDemo).toBe(false));
  it.each([
    [{ ...ok, cycleTime: 0 }],
    [{ ...ok, clipSize: 2.5 }],
    [{ ...ok, perBullet: null }],
    [{ ...ok, perBullet: [{ shot: 1, x: 'a', y: 0 }] }],
    [{ ...ok, clipSize: 1, perBullet: [{ shot: 1, x: 0, y: 0 }, { shot: 2, x: 0, y: 1 }] }],
    [null]
  ])('非法数据报错 %#', (d) => expect(() => validateWeapon(d)).toThrow(/格式错误/));
});

describe('角度 ↔ 像素投影', () => {
  it('画布高度对应垂直视野 73.74°（中心附近线性）', () => {
    // 600 像素高：f = 300 / tan(36.87°) = 400 px/rad
    expect(pxPerDegForHeight(600)).toBeCloseTo((400 * Math.PI) / 180, 6);
    expect(pxPerDegForHeight(600, 3)).toBeCloseTo((1200 * Math.PI) / 180, 6);
  });
  it('y 向上为正（画布 y 取反），4:3 拉伸横向放大', () => {
    const v = viewFor({ width: 960, height: 600 }, '4:3-stretched', 1, 0.5, 16 / 9);
    expect(v.stretchX).toBeCloseTo(4 / 3, 9);
    const p = toPx(v, 1, 1);
    expect(p.x - v.ox).toBeCloseTo(v.pxPerDeg * (4 / 3), 9);
    expect(p.y - v.oy).toBeCloseTo(-v.pxPerDeg, 9);
    const n = viewFor({ width: 960, height: 600 }, '16:9', 1, 0.5, 16 / 9);
    expect(n.stretchX).toBe(1);
    expect(n.pxPerDeg).toBeCloseTo(v.pxPerDeg, 9);
  });
});
