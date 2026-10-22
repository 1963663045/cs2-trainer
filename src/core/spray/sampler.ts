// 把原始鼠标移动转换为视角路径，并在每发子弹的发射时刻插值采样。
import type { MoveSample } from '../input/pointerInput';

export interface PathPoint {
  t: number; // 相对开火的毫秒
  x: number; // 视角累计偏移（度，+右）
  y: number; // 视角累计偏移（度，+上）
}

/** 发射时刻（ms，相对第一发）：t_k = k * cycle，连续时间，不按 tick 取整 */
export function shotTimes(cycleTimeS: number, count: number): number[] {
  return Array.from({ length: count }, (_, k) => Math.round(k * cycleTimeS * 1e6) / 1e3);
}

/**
 * 原始移动 -> 累计视角路径。鼠标向下移动(dy>0)使视角向下，所以 y 取负。
 * degPerCount = sens * m_yaw（m_pitch 默认与 m_yaw 相同）
 */
export function buildPath(samples: MoveSample[], t0: number, degPerCountX: number, degPerCountY = degPerCountX): PathPoint[] {
  const path: PathPoint[] = [{ t: 0, x: 0, y: 0 }];
  let cx = 0;
  let cy = 0;
  for (const s of samples) {
    if (s.t < t0) continue;
    cx += s.dx * degPerCountX;
    cy -= s.dy * degPerCountY;
    path.push({ t: s.t - t0, x: cx, y: cy });
  }
  return path;
}

/** 在时刻 t 线性插值路径（路径按 t 递增） */
export function sampleAt(path: PathPoint[], t: number): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 };
  if (t <= path[0].t) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function sampleShots(path: PathPoint[], times: number[]) {
  return times.map((t) => sampleAt(path, t));
}
