// Canvas 绘制工具（纯命令式，在 React 渲染循环之外由 requestAnimationFrame 调用）
import type { PatternPoint } from '../core/weapons';

import { stretchFactor, verticalFov, type AspectMode } from '../core/sens';

export interface View {
  ox: number; // 原点（初始瞄准点）像素
  oy: number;
  pxPerDeg: number; // 垂直方向每度像素
  stretchX?: number; // 横向倍数（4:3 拉伸 > 1）
}

/** 视角角度 -> 画布坐标（+y 向上为正，所以画布 y 取反） */
export const toPx = (v: View, xDeg: number, yDeg: number) => ({
  x: v.ox + xDeg * v.pxPerDeg * (v.stretchX ?? 1),
  y: v.oy - yDeg * v.pxPerDeg
});

/**
 * 画面中心附近每度对应的像素（线性近似，适用于压枪这种 ±15° 内的小角度）。
 * 以画布高度对应 CS2 的垂直视野（Hor+：所有比例下垂直视野都相同，约 73.74°）为基准，
 * 因此 16:9 / 16:10 / 4:3 黑边下每度像素一致；4:3 拉伸再乘横向倍数。zoom 只是放大观察。
 */
export function pxPerDegForHeight(canvasHeight: number, zoom = 1) {
  const f = canvasHeight / 2 / Math.tan(((verticalFov() / 2) * Math.PI) / 180);
  return f * (Math.PI / 180) * zoom;
}

/** 用水平视野推算（保留：旧接口） */
export function pxPerDegFor(canvasWidth: number, hfovDeg: number, zoom = 1) {
  const f = canvasWidth / 2 / Math.tan(((hfovDeg / 2) * Math.PI) / 180);
  return f * (Math.PI / 180) * zoom;
}

const screenAspect = () => (typeof window !== 'undefined' && window.screen?.height ? window.screen.width / window.screen.height : 16 / 9);

export function viewFor(canvas: { width: number; height: number }, aspect: AspectMode, zoom = 1, oyFrac = 0.5, scrAspect = screenAspect()): View {
  return {
    ox: canvas.width / 2,
    oy: canvas.height * oyFrac,
    pxPerDeg: pxPerDegForHeight(canvas.height, zoom),
    stretchX: stretchFactor(aspect, scrAspect)
  };
}

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0, 0, w, h);
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, stepDeg = 1) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = stepDeg * v.pxPerDeg;
  const stepX = step * (v.stretchX ?? 1);
  if (step < 6) return;
  ctx.beginPath();
  for (let x = v.ox % stepX; x < w; x += stepX) {
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
  const rx = r * (v.stretchX ?? 1);
  ctx.save();
  centers.forEach((c, i) => {
    const p = toPx(v, c.x, c.y);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, r, 0, 0, Math.PI * 2);
    ctx.strokeStyle = i === highlight ? 'rgba(250,204,21,0.9)' : 'rgba(250,204,21,0.18)';
    ctx.lineWidth = i === highlight ? 2 : 1;
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * 「游戏比例」每度像素（画布内部像素）：按显示器高度对应 CS2 垂直视野换算，
 * 使画布里的角度/像素关系与全屏游戏一致；再按画布 CSS 缩放折算到内部分辨率。
 */
export function gameScalePxPerDeg(canvas: HTMLCanvasElement, screenHeightCss = window.screen?.height || 1080) {
  const cssPerDeg = pxPerDegForHeight(screenHeightCss, 1);
  const scale = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  return cssPerDeg * scale;
}
