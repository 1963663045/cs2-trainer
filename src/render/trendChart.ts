// 轻量趋势图（Canvas2D，自绘，无第三方依赖）
import { extent, type TrendPoint } from '../core/replay/trend';

export interface ChartOpts {
  title: string;
  dashed?: boolean;
}

export function drawTrend(canvas: HTMLCanvasElement, pts: TrendPoint[], o: ChartOpts) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  const L = 40, R = 12, T = 28, B = 26;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(o.title, L, 16);
  const e = extent(pts);
  // 轴与网格
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = '#9ca3af';
  for (let v = 0; v <= 100; v += 25) {
    const y = T + (H - T - B) * (1 - v / 100);
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(W - R, y);
    ctx.stroke();
    ctx.fillText(String(v), 8, y + 4);
  }
  if (!e) {
    ctx.fillStyle = '#6b7280';
    ctx.fillText('暂无评分数据', W / 2 - 36, H / 2);
    return;
  }
  const X = (t: number) => L + ((t - e.t0) / (e.t1 - e.t0)) * (W - L - R);
  const Y = (v: number) => T + (H - T - B) * (1 - v / 100);
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(fmt(e.t0), L, H - 8);
  const s1 = fmt(e.t1);
  ctx.fillText(s1, W - R - ctx.measureText(s1).width, H - 8);

  const series: [keyof TrendPoint, string, string][] = [
    ['total', '#4ade80', '总分'],
    ['first10', '#60a5fa', '前 10 发']
  ];
  series.forEach(([k, color, label], si) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(o.dashed ? [5, 4] : []);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p[k] as number)) : ctx.moveTo(X(p.t), Y(p[k] as number))));
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(X(p.t), Y(p[k] as number), 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillText(`● ${label}`, W - R - 150 + si * 75, 16);
  });
}
