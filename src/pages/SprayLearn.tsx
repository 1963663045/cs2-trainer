import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { useWeapons } from '../components/useWeapons';
import { WeaponNotice, WeaponSelect } from '../components/WeaponSelect';
import { latestAttempt, type AttemptRecord } from '../core/replay/db';
import { degToCm, horizontalFov, renderAspectOf } from '../core/sens';
import { sampleAt } from '../core/spray/sampler';
import type { WeaponData } from '../core/weapons';
import * as R from '../render/sprayCanvas';

export default function SprayLearn() {
  const { list, selected, setSelected, weapon } = useWeapons('demo');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<WeaponData | null>(null);
  const attemptRef = useRef<AttemptRecord | null>(null);
  const playRef = useRef({ playing: true, start: performance.now(), speed: 1 });
  const [speed, setSpeed] = useState(1);
  const [hasAttempt, setHasAttempt] = useState(false);

  useEffect(() => {
    weaponRef.current = weapon;
    playRef.current.start = performance.now();
    attemptRef.current = null;
    setHasAttempt(false);
    latestAttempt().then((a) => {
      if (a && weapon && a.weaponId === weapon.id) {
        attemptRef.current = a;
        setHasAttempt(true);
      }
    });
  }, [weapon]);

  useEffect(() => {
    playRef.current.speed = speed;
    playRef.current.start = performance.now();
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0;
    const draw = (now: number) => {
      const ctx = canvas.getContext('2d')!;
      const w = weaponRef.current;
      const st = useSettings.getState();
      const v: R.View = { ox: canvas.width / 2, oy: canvas.height / 2, pxPerDeg: R.pxPerDegFor(canvas.width, horizontalFov(renderAspectOf(st.aspect)), 3) };
      R.clear(ctx, canvas.width, canvas.height);
      R.drawGrid(ctx, canvas.width, canvas.height, v, 1);
      if (w && w.perBullet.length) {
        const total = w.perBullet.length * w.cycleTime * 1000;
        const p = playRef.current;
        const t = (Math.max(0, now - p.start) * p.speed) % (total + 800); // 播完停 0.8 秒再循环
        const k = Math.max(1, Math.min(w.perBullet.length, Math.floor(t / (w.cycleTime * 1000)) + 1));
        const shown = w.perBullet.slice(0, k);
        R.drawPolyline(ctx, v, R.patternXY(w.perBullet), 'rgba(248,113,113,0.15)', 1);
        R.drawDots(ctx, v, R.patternXY(shown), '#f87171', 3, true);
        R.drawPolyline(ctx, v, R.compensationXY(shown), '#60a5fa', 2);
        const att = attemptRef.current;
        if (att) {
          const tt = Math.min(t, att.path.at(-1)?.t ?? 0);
          const cut = att.path.filter((q) => q.t <= tt);
          R.drawPolyline(ctx, v, cut, '#4ade80', 2);
          const cur = sampleAt(att.path, tt);
          const c = R.toPx(v, cur.x, cur.y);
          R.drawCrosshair(ctx, c.x, c.y);
        }
        R.drawCrosshair(ctx, v.ox, v.oy, 'rgba(255,255,255,0.4)');
        const last = w.perBullet[k - 1];
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '13px sans-serif';
        ctx.fillText(
          `第 ${k} 发  t = ${((k - 1) * w.cycleTime * 1000).toFixed(0)} ms  弹道偏移 (${last.x.toFixed(2)}°, ${last.y.toFixed(2)}°)  需反向移动约 ${degToCm(Math.hypot(last.x, last.y), st.dpi, st.sens, st.mYaw).toFixed(2)} cm`,
          12,
          canvas.height - 12
        );
        if (w.isDemo) R.drawBanner(ctx, '示意数据，非游戏真实弹道');
      } else if (w) {
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '15px sans-serif';
        ctx.fillText(`${w.name} 的逐发弹道尚未实测，暂无可演示的数据。`, 20, 40);
        ctx.fillText(`已知参数：射击间隔 ${w.cycleTime * 1000} ms，弹匣 ${w.clipSize} 发。`, 20, 64);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="page">
      <h2>弹道学习</h2>
      <div className="row">
        <WeaponSelect list={list} value={selected} onChange={setSelected} />
        <label>
          速度：
          <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×（真实射速）</option>
          </select>
        </label>
      </div>
      <WeaponNotice weapon={weapon} />
      <p className="muted">
        红点 = 弹道（子弹相对瞄准点的偏移，按射速逐发出现）；蓝线 = 反向补偿路径（视角需要移动的方向，下拉为向下）；绿线 = 你最近一次在该武器上的记录
        {hasAttempt ? '' : '（暂无记录）'}。
      </p>
      <canvas ref={canvasRef} width={960} height={600} className="stage" />
    </div>
  );
}
