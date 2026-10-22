import { useEffect, useRef, useState } from 'react';
import { useSettings, useRuntime } from '../store/settings';
import { usePointerInput } from '../components/usePointerInput';
import { useWeapons } from '../components/useWeapons';
import { WeaponNotice, WeaponSelect } from '../components/WeaponSelect';
import { SpraySession } from '../core/spray/session';
import { sampleShots, shotTimes } from '../core/spray/sampler';
import { scoreSpray, type ScoreResult } from '../core/scoring';
import { decayedIndex, patternSlice } from '../core/spray/recovery';
import { saveAttempt } from '../core/replay/db';
import { horizontalFov, renderAspectOf } from '../core/sens';
import type { WeaponData } from '../core/weapons';
import * as R from '../render/sprayCanvas';

const ZOOM = 3;

export default function SprayTrainer() {
  const { list, selected, setSelected, weapon, error } = useWeapons('demo');
  const input = usePointerInput();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<WeaponData | null>(null);
  const sessionRef = useRef<SpraySession | null>(null);
  // 上一次停火的时刻与停火时的弹道序号（用于恢复近似）
  const lastStopRef = useRef<{ t: number; index: number } | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [info, setInfo] = useState('点击画布锁定鼠标，然后按住左键开火（Esc 退出）');

  useEffect(() => {
    weaponRef.current = weapon;
    sessionRef.current = weapon ? new SpraySession(weapon.cycleTime, weapon.clipSize) : null;
    lastStopRef.current = null;
    setResult(null);
  }, [weapon]);

  useEffect(() => {
    const inp = input.current!;
    const canvas = canvasRef.current!;
    const offMove = inp.onMove((s) => sessionRef.current?.push(s));

    const finish = async (t: number) => {
      const ses = sessionRef.current;
      const w = weaponRef.current;
      if (!ses || !w || !ses.firing) return;
      ses.stop(t);
      const st = useSettings.getState();
      const dpc = st.sens * st.mYaw;
      const r = ses.result(dpc);
      let score: ScoreResult | null = null;
      lastStopRef.current = { t, index: ses.startIndex + r.shots };
      const pat = patternSlice(w.perBullet, ses.startIndex, r.shots);
      if (pat.length) {
        score = scoreSpray(pat, r.viewAtShots, { dpi: st.dpi, sens: st.sens, yaw: st.mYaw, toleranceDeg: st.toleranceDeg });
      }
      setResult(score);
      setInfo(`本次发射 ${r.shots} 发${ses.startIndex ? `（恢复近似：从第 ${ses.startIndex + 1} 发弹道开始）` : ''}${score ? `，总分 ${score.total}，前 10 发 ${score.first10}` : '（无逐发弹道，未评分）'}`);
      await saveAttempt({
        createdAt: Date.now(),
        weaponId: w.id,
        weaponName: w.name,
        isDemo: w.isDemo,
        shotsFired: r.shots,
        sens: st.sens,
        dpi: st.dpi,
        yaw: st.mYaw,
        rawInput: useRuntime.getState().raw === 'raw',
        path: r.path,
        viewAtShots: r.viewAtShots,
        score
      });
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!inp.locked) {
        inp.lock(canvas);
        return;
      }
      const t = e.timeStamp || performance.now();
      const st = useSettings.getState();
      const w = weaponRef.current;
      const last = lastStopRef.current;
      const startIdx = st.recoveryApprox && w?.recovery && last ? decayedIndex(last.index, (t - last.t) / 1000, w.recovery) : 0;
      sessionRef.current?.start(t, startIdx);
      setResult(null);
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) finish(e.timeStamp || performance.now());
    };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    let raf = 0;
    const draw = (now: number) => {
      const ctx = canvas.getContext('2d')!;
      const w = weaponRef.current;
      const ses = sessionRef.current;
      const st = useSettings.getState();
      const v: R.View = { ox: canvas.width / 2, oy: canvas.height * 0.4, pxPerDeg: R.pxPerDegFor(canvas.width, horizontalFov(renderAspectOf(st.aspect)), ZOOM) };
      R.clear(ctx, canvas.width, canvas.height);
      R.drawGrid(ctx, canvas.width, canvas.height, v, 1);
      if (w && ses) {
        if (ses.isEmpty(now)) finish(now);
        const dpc = st.sens * st.mYaw;
        const path = ses.livePath(dpc);
        const shots = ses.shotsAt(now);
        const pat = patternSlice(w.perBullet, ses.startIndex, ses.maxShots);
        const comp = R.compensationXY(pat);
        if (pat.length && st.showGuide) R.drawPolyline(ctx, v, comp, 'rgba(96,165,250,0.6)', 2, [6, 4]);
        if (pat.length && st.showTolerance) R.drawToleranceCircles(ctx, v, comp, st.toleranceDeg, ses.firing ? Math.min(shots, comp.length - 1) : -1);
        R.drawPolyline(ctx, v, path, '#4ade80', 2);
        if (pat.length && shots > 0) {
          const views = sampleShots(path, shotTimes(w.cycleTime, shots));
          const impacts = views.map((p, i) => ({ x: p.x + pat[i].x, y: p.y + pat[i].y }));
          R.drawDots(ctx, v, impacts, '#f87171', 3);
        }
        const cur = path[path.length - 1];
        const c = R.toPx(v, cur.x, cur.y);
        R.drawCrosshair(ctx, c.x, c.y);
        R.drawCrosshair(ctx, v.ox, v.oy, 'rgba(255,255,255,0.35)');
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '13px sans-serif';
        ctx.fillText(`子弹 ${shots}/${ses.maxShots}${ses.startIndex ? `（从第 ${ses.startIndex + 1} 发弹道起·恢复近似）` : ''}   射击间隔 ${w.cycleTime * 1000} ms   缩放 ×${ZOOM}`, 12, canvas.height - 12);
        if (w.isDemo) R.drawBanner(ctx, '示意数据，非游戏真实弹道');
        else if (!pat.length) R.drawBanner(ctx, '仅记录模式：该武器逐发弹道待实测，不评分', '#60a5fa');
        if (pat.length && st.showTolerance) {
          ctx.fillStyle = 'rgba(250,204,21,0.9)';
          ctx.fillText(`黄圈 = 容差圈（设置值 ${st.toleranceDeg}°，非游戏散布）`, 12, canvas.height - 32);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      offMove();
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, [input]);

  return (
    <div className="page">
      <h2>压枪训练</h2>
      {error && <div className="banner warn">{error}</div>}
      <div className="row">
        <WeaponSelect list={list} value={selected} onChange={setSelected} />
        <TrainerToggles />
      </div>
      <WeaponNotice weapon={weapon} />
      <p className="muted">
        绿色 = 你的视角轨迹；蓝色虚线 = 理想补偿路径；黄圈 = 容差圈（设置值）；红点 = 子弹落点（越靠近白色准星越好）。只记录你自己的鼠标移动，不会向游戏发送任何输入。
      </p>
      <canvas ref={canvasRef} width={960} height={600} className="stage" />
      <div className="muted">{info}</div>
      {result && (
        <div className="card">
          <div>
            总分 <b>{result.total}</b>　前 10 发 <b>{result.first10}</b>　平均误差 {result.meanErrDeg.toFixed(2)}° / {result.meanErrCm.toFixed(2)} cm
            {result.worstSegment && `　最差片段：第 ${result.worstSegment.from}–${result.worstSegment.to} 发（平均 ${result.worstSegment.meanErrDeg.toFixed(2)}°）`}
          </div>
          <details>
            <summary>逐发误差</summary>
            <table>
              <thead>
                <tr><th>#</th><th>水平°</th><th>垂直°</th><th>误差°</th><th>误差 cm</th><th>得分</th></tr>
              </thead>
              <tbody>
                {result.shots.map((s) => (
                  <tr key={s.shot}>
                    <td>{s.shot}</td><td>{s.dxDeg.toFixed(2)}</td><td>{s.dyDeg.toFixed(2)}</td><td>{s.errDeg.toFixed(2)}</td><td>{s.errCm.toFixed(2)}</td><td>{s.score.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}

function TrainerToggles() {
  const { showTolerance, recoveryApprox, toleranceDeg, set } = useSettings();
  return (
    <>
      <label>
        <input type="checkbox" checked={showTolerance} onChange={(e) => set({ showTolerance: e.target.checked })} /> 容差圈（设置值 {toleranceDeg}°）
      </label>
      <label title="停火后未完全恢复就再次开火时，按 vdata 恢复时间线性衰减弹道序号。Valve 未公开衰减曲线，这是近似。">
        <input type="checkbox" checked={recoveryApprox} onChange={(e) => set({ recoveryApprox: e.target.checked })} /> 停火恢复（近似，默认关）
      </label>
    </>
  );
}
