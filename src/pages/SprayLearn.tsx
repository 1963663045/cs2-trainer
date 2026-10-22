import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { useWeapons } from '../components/useWeapons';
import { WeaponNotice, WeaponSelect } from '../components/WeaponSelect';
import { latestAttempt, type AttemptRecord } from '../core/replay/db';
import { degToCm, fmt } from '../core/sens';
import { sampleAt } from '../core/spray/sampler';
import type { WeaponData } from '../core/weapons';
import * as R from '../render/sprayCanvas';
import { RafLoop } from '../render/loop';

export default function SprayLearn() {
  const { list, selected, setSelected, weapon, error, loading } = useWeapons('demo');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<WeaponData | null>(null);
  const attemptRef = useRef<AttemptRecord | null>(null);
  // 播放状态：elapsed 为已播放的「弹道时间」（ms），暂停时冻结
  const playRef = useRef({ playing: true, elapsed: 0, lastNow: -1, speed: 1 });
  const loopRef = useRef<RafLoop | null>(null);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [attemptFor, setAttemptFor] = useState<string | null>(null);
  const hasAttempt = !!weapon && attemptFor === weapon.id;

  useEffect(() => {
    weaponRef.current = weapon;
    playRef.current.elapsed = 0;
    attemptRef.current = null;
    let alive = true;
    if (weapon)
      latestAttempt(weapon.id).then((a) => {
        if (alive && a) {
          attemptRef.current = a;
          setAttemptFor(a.weaponId);
          loopRef.current?.kick();
        }
      });
    loopRef.current?.kick();
    return () => {
      alive = false;
    };
  }, [weapon]);

  useEffect(() => {
    playRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    playRef.current.playing = playing;
    playRef.current.lastNow = -1;
    loopRef.current?.kick();
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const loop = new RafLoop((now) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const w = weaponRef.current;
      const st = useSettings.getState();
      const p = playRef.current;
      if (p.playing && p.lastNow >= 0) p.elapsed += Math.min(100, now - p.lastNow) * p.speed;
      p.lastNow = now;
      const v = R.viewFor(canvas, st.aspect, 3, 0.5);
      R.clear(ctx, canvas.width, canvas.height);
      R.drawGrid(ctx, canvas.width, canvas.height, v, 1);
      if (w && w.perBullet.length) {
        const total = w.perBullet.length * w.cycleTime * 1000;
        const t = p.elapsed % (total + 800); // 播完停 0.8 秒再循环
        const k = Math.max(1, Math.min(w.perBullet.length, Math.floor(t / (w.cycleTime * 1000)) + 1));
        const shown = w.perBullet.slice(0, k);
        R.drawPolyline(ctx, v, R.patternXY(w.perBullet), 'rgba(248,113,113,0.15)', 1);
        R.drawDots(ctx, v, R.patternXY(shown), '#f87171', 3, true);
        R.drawPolyline(ctx, v, R.compensationXY(shown), '#60a5fa', 2);
        const att = attemptRef.current;
        if (att && att.path.length) {
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
          `第 ${k} 发  t = ${((k - 1) * w.cycleTime * 1000).toFixed(0)} ms  弹道偏移 (${fmt(last.x)}°, ${fmt(last.y)}°)  需反向移动约 ${fmt(degToCm(Math.hypot(last.x, last.y), st.dpi, st.sens, st.mYaw))} cm${p.playing ? '' : '  ⏸ 已暂停'}`,
          12,
          canvas.height - 12
        );
        if (w.isDemo) R.drawBanner(ctx, '示意数据，非游戏真实弹道');
        // 只有播放中且页面可见才持续绘制
        return p.playing && document.visibilityState === 'visible';
      }
      if (w) {
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '15px sans-serif';
        ctx.fillText(`${w.name} 的逐发弹道尚未实测，暂无可演示的数据。`, 20, 40);
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(`已知参数：射击间隔 ${fmt(w.cycleTime * 1000, 0)} ms，弹匣 ${w.clipSize} 发。`, 20, 64);
      }
      return false;
    });
    loopRef.current = loop;
    const onVis = () => {
      playRef.current.lastNow = -1;
      loop.kick();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((x) => !x);
      } else if (e.key === 'r' || e.key === 'R') {
        playRef.current.elapsed = 0;
        loop.kick();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    const offSettings = useSettings.subscribe(loop.kick);
    loop.kick();
    return () => {
      loop.dispose();
      loopRef.current = null;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      offSettings();
    };
  }, []);

  return (
    <div className="page">
      <h2>弹道学习</h2>
      {error && <div className="banner warn" role="alert">武器数据加载失败：{error}（请刷新重试）</div>}
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
        <button type="button" onClick={() => setPlaying((x) => !x)}>{playing ? '暂停（空格）' : '播放（空格）'}</button>
        <button type="button" onClick={() => { playRef.current.elapsed = 0; loopRef.current?.kick(); }}>从头播放（R）</button>
        {loading && <span className="muted">加载中…</span>}
      </div>
      <WeaponNotice weapon={weapon} />
      <p className="muted">
        红点 = 弹道（子弹相对瞄准点的偏移，按射速逐发出现）；蓝线 = 反向补偿路径（视角需要移动的方向，下拉为向下）；绿线 = 你最近一次在该武器上的记录
        {hasAttempt ? '' : '（暂无记录）'}。画面放大 ×3。
      </p>
      <canvas ref={canvasRef} width={960} height={600} className="stage" role="img" aria-label="弹道与补偿路径动画" data-testid="learn-canvas" />
    </div>
  );
}
