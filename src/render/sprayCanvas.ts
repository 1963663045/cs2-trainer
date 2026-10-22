// Canvas 绘制工具（纯命令式，在 React 渲染循环之外由 requestAnimationFrame 调用）
import type { PatternPoint } from '../core/weapons';

export interface View {
  ox: number; // 原点（初始瞄准点）像素
  oy: number;
  pxPerDeg: number;
}

/** 视角角度 -> 画布坐标（+y 向上为正，所以画布 y 取反） */
export const toPx = (v: View, xDeg: number, yDeg: number) => ({ x: v.ox + xDeg * v.pxPerDeg, y: v.oy - yDeg * v.pxPerDeg });

/** 由水平 FOV 估算画布上每度像素（中心附近线性近似），zoom 便于观察 */
export function pxPerDegFor(canvasWidth: number, hfovDeg: number, zoom = 1) {
  const f = canvasWidth / 2 / Math.tan(((hfovDeg / 2) * Math.PI) / 180);
  return f * (Math.PI / 180) * zoom;
}

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0, 0, w, h);
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, stepDeg = 1) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = stepDeg * v.pxPerDeg;
  if (step < 6) return;
  ctx.beginPath();
  for (let x = v.ox % step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = v.oy % step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#4ade80') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x - 3, y);
  ctx.moveTo(x + 3, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y - 3);
  ctx.moveTo(x, y + 3);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
}

export function drawPolyline(ctx: CanvasRenderingContext2D, v: View, pts: { x: number; y: number }[], color: string, width = 2, dash: number[] = []) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = toPx(v, p.x, p.y);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawDots(ctx: CanvasRenderingContext2D, v: View, pts: { x: number; y: number }[], color: string, r = 3, label = false) {
  ctx.fillStyle = color;
  ctx.font = '10px sans-serif';
  pts.forEach((p, i) => {
    const q = toPx(v, p.x, p.y);
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (label && (i === 0 || (i + 1) % 5 === 0)) ctx.fillText(String(i + 1), q.x + 5, q.y - 4);
  });
}

export const patternXY = (p: PatternPoint[]) => p.map((q) => ({ x: q.x, y: q.y }));
export const compensationXY = (p: PatternPoint[]) => p.map((q) => ({ x: -q.x, y: -q.y }));

export function drawBanner(ctx: CanvasRenderingContext2D, text: string, color = '#f59e0b') {
  ctx.fillStyle = color;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(text, 12, 22);
}

/** 容差圈：以理想视角点为圆心，半径为角度（度） */
export function drawToleranceCircles(
  ctx: CanvasRenderingContext2D,
  v: View,
  centers: { x: number; y: number }[],
  radiusDeg: number,
  highlight = -1
) {
  const r = radiusDeg * v.pxPerDeg;
  ctx.save();
  centers.forEach((c, i) => {
    const p = toPx(v, c.x, c.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = i === highlight ? 'rgba(250,204,21,0.9)' : 'rgba(250,204,21,0.18)';
    ctx.lineWidth = i === highlight ? 2 : 1;
    ctx.stroke();
  });
  ctx.restore();
}
