// 历史趋势：把训练记录整理成图表数据（与 UI 无关，便于测试）
import type { AttemptRecord } from './db';

export interface TrendPoint {
  t: number; // createdAt (ms)
  total: number;
  first10: number;
  weaponId: string;
}

export interface TrendData {
  real: TrendPoint[]; // 真实武器数据的评分记录
  demo: TrendPoint[]; // 示意数据的评分记录（单独显示，不与真实成绩混合）
  unscored: number; // 无逐发弹道（仅记录）的条数
}

type Rec = Pick<AttemptRecord, 'createdAt' | 'weaponId' | 'isDemo' | 'score'>;

/** weaponId = 'all' 表示不过滤 */
export function buildTrend(records: Rec[], weaponId = 'all'): TrendData {
  const out: TrendData = { real: [], demo: [], unscored: 0 };
  for (const r of records) {
    if (weaponId !== 'all' && r.weaponId !== weaponId) continue;
    if (!r.score) {
      out.unscored++;
      continue;
    }
    const p = { t: r.createdAt, total: r.score.total, first10: r.score.first10, weaponId: r.weaponId };
    (r.isDemo ? out.demo : out.real).push(p);
  }
  out.real.sort((a, b) => a.t - b.t);
  out.demo.sort((a, b) => a.t - b.t);
  return out;
}

/** 记录中出现过的武器（用于筛选下拉框） */
export function weaponsIn(records: Pick<AttemptRecord, 'weaponId' | 'weaponName' | 'isDemo'>[]) {
  const m = new Map<string, { id: string; name: string; isDemo: boolean }>();
  for (const r of records) if (!m.has(r.weaponId)) m.set(r.weaponId, { id: r.weaponId, name: r.weaponName, isDemo: r.isDemo });
  return [...m.values()];
}

/** 数值范围（含少量留白），用于坐标轴 */
export function extent(points: TrendPoint[]) {
  if (!points.length) return null;
  const ts = points.map((p) => p.t);
  let t0 = Math.min(...ts);
  let t1 = Math.max(...ts);
  if (t0 === t1) {
    t0 -= 60_000;
    t1 += 60_000;
  }
  return { t0, t1, y0: 0, y1: 100 };
}
