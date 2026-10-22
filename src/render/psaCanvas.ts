// PSA 小任务的绘制：以准星为中心，世界网格与目标随视角移动（线性近似，小角度足够）
import type { MicroTask } from '../core/sens/microTask';

export function drawMicroTask(ctx: CanvasRenderingContext2D, W: number, H: number, task: MicroTask, pxPerDeg: number, label: string, stretchX = 1, now = 0) {
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const sx = (yaw: number) => cx + (yaw - task.yaw) * pxPerDeg * stretchX;
  const sy = (pitch: number) => cy - (pitch - task.pitch) * pxPerDeg;
  // 世界网格，每 5°
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = 5;
  const halfW = W / 2 / (pxPerDeg * stretchX);
  const halfH = H / 2 / pxPerDeg;
  for (let g = Math.floor((task.yaw - halfW) / step) * step; g <= task.yaw + halfW; g += step) {
    ctx.beginPath();
    ctx.moveTo(sx(g), 0);
    ctx.lineTo(sx(g), H);
    ctx.stroke();
  }
  for (let g = Math.floor((task.pitch - halfH) / step) * step; g <= task.pitch + halfH; g += step) {
    ctx.beginPath();
    ctx.moveTo(0, sy(g));
    ctx.lineTo(W, sy(g));
    ctx.stroke();
  }
  if (task.phase === 'flick' || task.phase === 'track') {
    const r = Math.max(4, task.opts.targetRadiusDeg * pxPerDeg);
    ctx.beginPath();
    ctx.ellipse(sx(task.target.yaw), sy(task.target.pitch), r * stretchX, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = task.phase === 'flick' ? '#f87171' : '#f59e0b';
    ctx.fill();
  }
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  // 目标在画布外：在边缘画箭头指示方向
  if (task.phase === 'flick') {
    const tx = sx(task.target.yaw);
    const ty = sy(task.target.pitch);
    const m = 18;
    if (tx < m || tx > W - m || ty < m || ty > H - m) {
      const ang = Math.atan2(ty - cy, tx - cx);
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-9), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-9));
      const ax = cx + Math.cos(ang) * k;
      const ay = cy + Math.sin(ang) * k;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, -7);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '14px sans-serif';
  const n = task.opts.flickTargets;
  const hint =
    task.phase === 'ready'
      ? '准备…（目标马上出现）'
      : task.phase === 'flick'
        ? `甩枪：瞄准红色目标并点击左键　目标 ${task.targetNo}/${n}`
        : task.phase === 'track'
          ? '跟枪：让准星始终贴住黄色目标'
          : '完成';
  ctx.fillText(`${label}　${hint}`, 12, 22);
  if (task.phase === 'flick') {
    // 当前目标剩余时间条（超时记为失误并换下一个目标）
    const f = task.timeLeft(now) / task.opts.flickTimeoutMs;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(12, 30, 200, 4);
    ctx.fillStyle = f > 0.3 ? '#4ade80' : '#f87171';
    ctx.fillRect(12, 30, 200 * f, 4);
    const r = task.results;
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`命中 ${r.filter((x) => x === 'hit').length}　超时 ${r.filter((x) => x === 'timeout').length}　空枪 ${task.missClicks}`, 220, 37);
  }
}
