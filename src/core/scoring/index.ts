// 评分：比较玩家每发的视角补偿与理想补偿（= 弹道取反）。
// 子弹实际落点偏差 = 玩家视角偏移 + 弹道偏移；理想时为 0。
import type { PatternPoint } from '../weapons';
import { degToCm } from '../sens';

export interface ShotError {
  shot: number;
  dxDeg: number;
  dyDeg: number;
  errDeg: number;
  errCm: number;
  score: number; // 0..100
  /** 是否计入总分 / 前 10 发 / 平均误差 / 最差片段。第 1 发恒为 false（见 scoreSpray 说明） */
  counted: boolean;
}

/** 少于该发数的连射不评分、不保存（单击或极短点射没有压枪意义，且会被第 1 发虚高） */
export const MIN_SHOTS = 5;

export interface ScoreResult {
  shots: ShotError[];
  total: number;
  first10: number;
  meanErrDeg: number;
  meanErrCm: number;
  worstSegment: { from: number; to: number; meanErrDeg: number } | null;
}

export interface ScoreOptions {
  dpi: number;
  sens: number;
  yaw: number;
  toleranceDeg?: number; // 误差达到该值时单发得 0 分
  segmentSize?: number; // 最差片段窗口大小
}

/**
 * 第 1 发在按下瞬间发射，此时视角尚未移动、弹道偏移也为 0，误差恒为 0（必得满分），
 * 与压枪水平无关，因此不计入任何汇总指标，只在逐发表中显示。
 * 「前 10 发」= 第 2–10 发。
 */
export function scoreSpray(
  pattern: PatternPoint[],
  viewAtShots: { x: number; y: number }[],
  opts: ScoreOptions
): ScoreResult {
  const tol = opts.toleranceDeg ?? 1.5;
  const seg = opts.segmentSize ?? 5;
  const n = Math.min(pattern.length, viewAtShots.length);
  const shots: ShotError[] = [];
  for (let i = 0; i < n; i++) {
    const dx = viewAtShots[i].x + pattern[i].x;
    const dy = viewAtShots[i].y + pattern[i].y;
    const err = Math.hypot(dx, dy);
    shots.push({
      shot: pattern[i].shot,
      dxDeg: dx,
      dyDeg: dy,
      errDeg: err,
      errCm: degToCm(err, opts.dpi, opts.sens, opts.yaw),
      score: Math.max(0, 100 * (1 - err / tol)),
      counted: i > 0
    });
  }
  const counted = shots.filter((s) => s.counted);
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  let worst: ScoreResult['worstSegment'] = null;
  if (counted.length >= seg) {
    for (let i = 0; i + seg <= counted.length; i++) {
      const m = mean(counted.slice(i, i + seg).map((s) => s.errDeg));
      if (!worst || m > worst.meanErrDeg) worst = { from: counted[i].shot, to: counted[i + seg - 1].shot, meanErrDeg: m };
    }
  }
  return {
    shots,
    total: Math.round(mean(counted.map((s) => s.score))),
    first10: Math.round(mean(counted.slice(0, 9).map((s) => s.score))),
    meanErrDeg: mean(counted.map((s) => s.errDeg)),
    meanErrCm: mean(counted.map((s) => s.errCm)),
    worstSegment: worst
  };
}
