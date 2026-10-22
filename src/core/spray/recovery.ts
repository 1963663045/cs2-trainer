// 停火后弹道恢复 —— 近似模型（默认关闭）
// 依据：weapons.vdata 只公开了恢复时间参数（m_flRecoveryTimeStand/StandFinal/Crouch/CrouchFinal，
// 以及 m_nRecoveryTransitionStartBullet/EndBullet）。Valve 没有公开具体衰减曲线，
// 因此这里用「按恢复时间线性衰减弹道序号」做近似，界面与 README 都标注为近似。

export interface RecoveryParams {
  RecoveryTimeStand?: number;
  RecoveryTimeStandFinal?: number;
  RecoveryTimeCrouch?: number;
  RecoveryTimeCrouchFinal?: number;
  RecoveryTransitionStartBullet?: number;
  RecoveryTransitionEndBullet?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 当前弹道序号对应的恢复时间（秒）：在 Start~End 发之间从初始值线性过渡到 Final 值 */
export function recoveryTimeFor(rec: RecoveryParams, index: number, crouch = false): number | null {
  const t0 = crouch ? rec.RecoveryTimeCrouch : rec.RecoveryTimeStand;
  const t1 = (crouch ? rec.RecoveryTimeCrouchFinal : rec.RecoveryTimeStandFinal) ?? t0;
  if (t0 == null || t1 == null) return null;
  const s = rec.RecoveryTransitionStartBullet ?? 0;
  const e = rec.RecoveryTransitionEndBullet ?? s;
  const f = e > s ? clamp01((index - s) / (e - s)) : index >= s ? 1 : 0;
  return t0 + (t1 - t0) * f;
}

/**
 * 近似：停火 elapsedS 秒后重新开火，弹道从哪个序号继续（0 = 完全恢复，从第 1 发开始）。
 * 序号在恢复时间内线性衰减到 0。参数缺失时视为完全恢复。
 */
export function decayedIndex(prevIndex: number, elapsedS: number, rec: RecoveryParams, crouch = false): number {
  if (prevIndex <= 0) return 0;
  const T = recoveryTimeFor(rec, prevIndex, crouch);
  if (!T || T <= 0) return 0;
  return Math.max(0, Math.floor(prevIndex * (1 - elapsedS / T)));
}

import type { PatternPoint } from '../weapons';

/**
 * 从第 start 发（0 起）开始取 n 发弹道，并以起始发为原点重新归零（近似：忽略残留后坐力）。
 * start = 0 时等价于 pattern.slice(0, n)。
 */
export function patternSlice(pattern: PatternPoint[], start: number, n: number): PatternPoint[] {
  const seg = pattern.slice(start, start + n);
  if (start === 0 || !seg.length) return seg;
  const o = pattern[start];
  return seg.map((p, i) => ({ shot: i + 1, x: p.x - o.x, y: p.y - o.y }));
}
