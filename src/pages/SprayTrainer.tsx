import { useEffect, useRef, useState } from 'react';
import { useSettings, useRuntime } from '../store/settings';
import { usePointerInput } from '../components/usePointerInput';
import { useWeapons } from '../components/useWeapons';
import { WeaponNotice, WeaponSelect } from '../components/WeaponSelect';
import { SpraySession } from '../core/spray/session';
import { sampleShots, shotTimes } from '../core/spray/sampler';
import { decayedIndex, patternSlice } from '../core/spray/recovery';
import { MIN_SHOTS, scoreSpray, type ScoreResult } from '../core/scoring';
import { saveAttempt } from '../core/replay/db';
import { fmt } from '../core/sens';
import type { WeaponData } from '../core/weapons';
import * as R from '../render/sprayCanvas';
import { RafLoop } from '../render/loop';

const ZOOM = 3;
const IDLE_HINT = '点击画布锁定鼠标，然后按住左键开火；松开停止。快捷键：R 重置，Esc 退出锁定。';

export default function SprayTrainer() {
  const { list, selected, setSelected, weapon, error, loading } = useWeapons('demo');
  const input = usePointerInput();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<WeaponData | null>(null);
  const sessionRef = useRef<SpraySession | null>(null);
  const loopRef = useRef<RafLoop | null>(null);
  // 上一次停火的时刻与停火时的弹道序号（用于恢复近似）
  const lastStopRef = useRef<{ t: number; index: number } | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [info, setInfo] = useState(IDLE_HINT);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    weaponRef.current = weapon;
    sessionRef.current = weapon ? new SpraySession(weapon.cycleTime, weapon.clipSize) : null;
    lastStopRef.current = null;
    setResult(null);
    setInfo(IDLE_HINT);
    loopRef.current?.kick();
  }, [weapon]);

  useEffect(() => {
    const inp = input.current!;
    const canvas = canvasRef.current!;

    let buttonSeen = false;
    const abort = (msg: string) => {
      const ses = sessionRef.current;
      if (ses?.firing) {
        ses.stop(performance.now());
        ses.samples = [];
        setInfo(msg);
      }
    };

    const reset = () => {
      const w = weaponRef.current;
      sessionRef.current = w ? new SpraySession(w.cycleTime, w.clipSize) : null;
      lastStopRef.current = null;
      setResult(null);
      setInfo(IDLE_HINT);
      loop.kick();
    };

    const finish = async (t: number) => {
      const ses = sessionRef.current;
      const w = weaponRef.current;
      if (!ses || !w || !ses.firing) return;
      ses.stop(t);
      const st = useSettings.getState();
      const dpc = st.sens * st.mYaw;
      const r = ses.result(dpc);
      lastStopRef.current = { t, index: ses.startIndex + r.shots };
      if (r.shots < MIN_SHOTS) {
        // 单击 / 极短点射：不评分、不保存
        setResult(null);
        setInfo(`射击太短（${r.shots} 发，至少 ${MIN_SHOTS} 发），未计分、未保存。按住左键连射。`);
        loop.kick();
        return;
      }
      const pat = patternSlice(w.perBullet, ses.startIndex, r.shots);
      let score: ScoreResult | null = null;
      if (pat.length) {
        score = scoreSpray(pat, r.viewAtShots, { dpi: st.dpi, sens: st.sens, yaw: st.mYaw, toleranceDeg: st.toleranceDeg });
      }
      setResult(score);
      const from = ses.startIndex ? `（恢复近似：从第 ${ses.startIndex + 1} 发弹道开始）` : '';
      const dropped = inp.stats.dropped ? `；已过滤异常位移事件 ${inp.stats.dropped} 个` : '';
      setInfo(`本次发射 ${r.shots} 发${from}${score ? `，总分 ${score.total}，前 10 发 ${score.first10}` : '（无逐发弹道，仅记录，未评分）'}${dropped}。按住左键再来一次，R 重置。`);
      loop.kick();
      try {
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
      } catch (e) {
        setInfo((s) => `${s}（保存记录失败：${String(e)}）`);
      }
    };

    const offMove = inp.onMove((s) => {
      const ses = sessionRef.current;
      if (!ses?.firing) return;
      // 左键在锁定期间被松开但 mouseup 丢失时（极少见），用事件里的按键状态兜底，避免「卡住开火」。
      // 只有在本次开火中见过「左键按下」位之后才信任该字段（防止某些实现始终报告 0）。
      if (s.buttons !== undefined) {
        if (s.buttons & 1) buttonSeen = true;
        else if (buttonSeen) {
          finish(s.t);
          return;
        }
      }
      ses.push(s);
    });
    const offLock = inp.onLock((e) => {
      setLocked(e.locked);
      if (!e.locked) {
        const why = e.reason === 'blur' ? '窗口失去焦点' : e.reason === 'hidden' ? '切换了标签页' : '退出了鼠标锁定';
        abort(`${why}，本次尝试已中断（不保存）。点击画布重新锁定。`);
      }
      loop.kick();
    });
    const offErr = inp.onError((msg) => setInfo(msg));

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (!inp.locked) {
        inp.lock(canvas);
        return;
      }
      const ses = sessionRef.current;
      if (!ses || ses.firing) return;
      const t = e.timeStamp || performance.now();
      const st = useSettings.getState();
      const w = weaponRef.current;
      const last = lastStopRef.current;
      const startIdx = st.recoveryApprox && w?.recovery && last ? decayedIndex(last.index, (t - last.t) / 1000, w.recovery) : 0;
      buttonSeen = false;
      ses.start(t, startIdx);
      setResult(null);
      setInfo('开火中…');
      loop.kick();
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) finish(e.timeStamp || performance.now());
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r' || e.key === 'R') {
        abort('已重置。');
        reset();
      }
    };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);

    const loop = new RafLoop((now) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const w = weaponRef.current;
      const ses = sessionRef.current;
      const st = useSettings.getState();
      const v = R.viewFor(canvas, st.aspect, ZOOM, 0.4);
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
        const from = ses.startIndex ? `（从第 ${ses.startIndex + 1} 发弹道起·恢复近似）` : '';
        ctx.fillText(`子弹 ${shots}/${ses.maxShots}${from}   射击间隔 ${fmt(w.cycleTime * 1000, 0)} ms   缩放 ×${ZOOM}`, 12, canvas.height - 12);
        if (w.isDemo) R.drawBanner(ctx, '示意数据，非游戏真实弹道');
        else if (!pat.length) R.drawBanner(ctx, '仅记录模式：该武器逐发弹道待实测，不评分', '#60a5fa');
        if (pat.length && st.showTolerance) {
          ctx.fillStyle = 'rgba(250,204,21,0.9)';
          ctx.fillText(`黄圈 = 容差圈（设置值 ${st.toleranceDeg}°，非游戏散布）`, 12, canvas.height - 32);
        }
      }
      if (!inp.locked) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, canvas.height / 2 - 22, canvas.width, 40);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('点击此处锁定鼠标开始练习', canvas.width / 2, canvas.height / 2 + 4);
        ctx.textAlign = 'start';
      }
      return inp.locked || !!ses?.firing;
    });
    loopRef.current = loop;
    const offSettings = useSettings.subscribe(loop.kick);
    loop.kick();
    return () => {
      loop.dispose();
      loopRef.current = null;
      offMove();
      offLock();
      offErr();
      offSettings();
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [input]);

  return (
    <div className="page">
      <h2>压枪训练</h2>
      {error && <div className="banner warn" role="alert">武器数据加载失败：{error}（请刷新重试）</div>}
      <div className="row">
        <WeaponSelect list={list} value={selected} onChange={setSelected} />
        <TrainerToggles />
        {loading && <span className="muted">加载武器数据…</span>}
      </div>
      <WeaponNotice weapon={weapon} />
      <details className="help">
        <summary>怎么练？</summary>
        <ol>
          <li>至少连射 {MIN_SHOTS} 发才会评分并保存；单击不计。</li>
          <li>先在「设置」页填好 DPI 与 CS2 灵敏度（与游戏一致），这样角度换算才准确。</li>
          <li>点击画布锁定鼠标，按住左键开火，像在游戏里一样往反方向拉鼠标；松开或打空弹匣结束。</li>
          <li>绿色 = 你的视角轨迹；蓝色虚线 = 理想补偿路径；黄圈 = 容差圈（设置值）；红点 = 子弹落点，越靠近白色准星越好。</li>
          <li>画面放大 ×{ZOOM} 便于观察；评分只按角度计算，与画面大小无关。</li>
        </ol>
        <p className="muted">只记录你自己的鼠标移动，不会向游戏或系统发送任何输入。</p>
      </details>
      <canvas
        ref={canvasRef}
        width={960}
        height={600}
        className="stage"
        data-testid="trainer-canvas"
        data-locked={locked ? '1' : '0'}
        role="img"
        aria-label="压枪训练画布：点击锁定鼠标后按住左键开火"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="muted" aria-live="polite" data-testid="trainer-info">{info}</div>
      {result && (
        <div className="card" data-testid="trainer-result">
          <div>
            总分 <b data-testid="score-total">{result.total}</b>　前 10 发 <b data-testid="score-first10">{result.first10}</b>
            <small className="muted">（第 1 发恒在准星处，不计分；前 10 发 = 第 2–10 发）</small>　平均误差 {fmt(result.meanErrDeg)}° / {fmt(result.meanErrCm)} cm
            {result.worstSegment && `　最差片段：第 ${result.worstSegment.from}–${result.worstSegment.to} 发（平均 ${fmt(result.worstSegment.meanErrDeg)}°）`}
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
                    <td>{s.shot}</td><td>{fmt(s.dxDeg)}</td><td>{fmt(s.dyDeg)}</td><td>{fmt(s.errDeg)}</td><td>{fmt(s.errCm)}</td><td>{s.counted ? fmt(s.score, 0) : '不计分'}</td>
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
