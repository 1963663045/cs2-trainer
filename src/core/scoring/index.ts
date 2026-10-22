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
}

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
      score: Math.max(0, 100 * (1 - err / tol))
    });
  }
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  let worst: ScoreResult['worstSegment'] = null;
  if (n >= seg) {
    for (let i = 0; i + seg <= n; i++) {
      const m = mean(shots.slice(i, i + seg).map((s) => s.errDeg));
      if (!worst || m > worst.meanErrDeg) worst = { from: shots[i].shot, to: shots[i + seg - 1].shot, meanErrDeg: m };
    }
  }
  return {
    shots,
    total: Math.round(mean(shots.map((s) => s.score))),
    first10: Math.round(mean(shots.slice(0, 10).map((s) => s.score))),
    meanErrDeg: mean(shots.map((s) => s.errDeg)),
    meanErrCm: mean(shots.map((s) => s.errCm)),
    worstSegment: worst
  };
}
