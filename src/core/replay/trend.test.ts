import { describe, expect, it } from 'vitest';
import { buildTrend, extent, weaponsIn } from './trend';

const sc = (total: number, first10: number) => ({ total, first10 } as never);
const recs = [
  { createdAt: 3, weaponId: 'demo', weaponName: '示意', isDemo: true, score: sc(50, 60) },
  { createdAt: 1, weaponId: 'ak47', weaponName: 'AK-47', isDemo: false, score: sc(70, 80) },
  { createdAt: 2, weaponId: 'ak47', weaponName: 'AK-47', isDemo: false, score: null },
  { createdAt: 0, weaponId: 'm4a4', weaponName: 'M4A4', isDemo: false, score: sc(40, 45) }
];

describe('趋势数据整理', () => {
  it('示意数据与真实数据分开，未评分单独计数，按时间排序', () => {
    const d = buildTrend(recs);
    expect(d.real.map((p) => p.t)).toEqual([0, 1]);
    expect(d.demo).toEqual([{ t: 3, total: 50, first10: 60, weaponId: 'demo' }]);
    expect(d.unscored).toBe(1);
  });
  it('按武器过滤', () => {
    const d = buildTrend(recs, 'ak47');
    expect(d.real).toEqual([{ t: 1, total: 70, first10: 80, weaponId: 'ak47' }]);
    expect(d.demo).toEqual([]);
    expect(d.unscored).toBe(1);
  });
  it('武器列表去重', () => {
    expect(weaponsIn(recs).map((w) => w.id)).toEqual(['demo', 'ak47', 'm4a4']);
  });
  it('单点时扩展时间轴', () => {
    expect(extent([{ t: 1000, total: 1, first10: 1, weaponId: 'x' }])).toEqual({ t0: -59000, t1: 61000, y0: 0, y1: 100 });
    expect(extent([])).toBeNull();
  });
});
