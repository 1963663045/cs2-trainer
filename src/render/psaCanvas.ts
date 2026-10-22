// PSA 小任务的绘制：以准星为中心，世界网格与目标随视角移动（线性近似，小角度足够）
import type { MicroTask } from '../core/sens/microTask';

export function drawMicroTask(ctx: CanvasRenderingContext2D, W: number, H: number, task: MicroTask, pxPerDeg: number, label: string, stretchX = 1) {
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
  if (task.phase !== 'done') {
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
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '14px sans-serif';
  const hint = task.phase === 'flick' ? '甩枪：瞄准红色目标并点击左键' : task.phase === 'track' ? '跟枪：让准星始终贴住黄色目标' : '完成';
  ctx.fillText(`${label}　${hint}`, 12, 22);
}
