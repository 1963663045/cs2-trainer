// PSA 找灵敏度（盲测 A/B）。画布逻辑在 rAF 中运行，React 只管阶段切换。
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { usePointerInput } from './usePointerInput';
import { candidates, initPsa, isDone, pickAB, psaResult, type PsaState } from '../core/sens/psa';
import { MicroTask, type MicroTaskMetrics } from '../core/sens/microTask';
import { cmPer360, horizontalFov, renderAspectOf } from '../core/sens';
import { savePsaResult } from '../core/replay/db';
import { drawMicroTask } from '../render/psaCanvas';
import { pxPerDegFor } from '../render/sprayCanvas';

type Phase = 'idle' | 'A' | 'B' | 'choose' | 'done';

const fmtM = (m?: MicroTaskMetrics) =>
  m
    ? `命中 ${m.hits}，失误 ${m.misses}，甩枪平均 ${m.flickMeanMs ? m.flickMeanMs.toFixed(0) + ' ms' : '—'}，跟枪平均误差 ${m.trackMeanErrDeg != null ? m.trackMeanErrDeg.toFixed(2) + '°' : '—'}`
    : '—';

export default function PsaFinder() {
  const settings = useSettings();
  const input = usePointerInput();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [psa, setPsa] = useState<PsaState | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [spread, setSpread] = useState(0.5);
  const [rounds, setRounds] = useState(7);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState<{ A?: MicroTaskMetrics; B?: MicroTaskMetrics }>({});
  const [saved, setSaved] = useState(false);
  const taskRef = useRef<MicroTask | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const psaRef = useRef<PsaState | null>(null);
  phaseRef.current = phase;
  psaRef.current = psa;

  const beginRun = (p: 'A' | 'B') => {
    const s = psaRef.current!;
    const c = candidates(s);
    const sens = p === 'A' ? c.a : c.b;
    taskRef.current = new MicroTask(sens * useSettings.getState().mYaw);
    setPhase(p);
  };

  useEffect(() => {
    const inp = input.current!;
    const canvas = canvasRef.current!;
    const offMove = inp.onMove((s) => taskRef.current?.move(s.dx, s.dy));
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!inp.locked) {
        inp.lock(canvas);
        return;
      }
      taskRef.current?.click(e.timeStamp || performance.now());
    };
    canvas.addEventListener('mousedown', onDown);
    let raf = 0;
    const loop = (now: number) => {
      const ctx = canvas.getContext('2d')!;
      const ph = phaseRef.current;
      const task = taskRef.current;
      const st = useSettings.getState();
      const ppd = pxPerDegFor(canvas.width, horizontalFov(renderAspectOf(st.aspect)), 1);
      if ((ph === 'A' || ph === 'B') && task) {
        if (inp.locked) task.update(now);
        drawMicroTask(ctx, canvas.width, canvas.height, task, ppd, `候选 ${ph}（第 ${(psaRef.current?.round ?? 0) + 1} 轮）`);
        if (!inp.locked) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#e5e7eb';
          ctx.fillText('点击画布锁定鼠标后开始（计时从锁定后开始）', canvas.width / 2 - 150, canvas.height / 2);
        }
        if (task.done) {
          const m = task.metrics();
          taskRef.current = null;
          setMetrics((old) => ({ ...old, [ph]: m }));
          if (ph === 'A') beginRun('B');
          else {
            setPhase('choose');
            inp.unlock();
          }
        }
      } else {
        ctx.fillStyle = '#0b0f17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px sans-serif';
        const msg = ph === 'choose' ? '请在下方选择手感更好的一组' : ph === 'done' ? '已完成' : '点击「开始」进行 PSA 盲测';
        ctx.fillText(msg, 16, 24);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      offMove();
      canvas.removeEventListener('mousedown', onDown);
    };
  }, [input]);

  const start = () => {
    const s = initPsa(settings.sens, spread, rounds);
    psaRef.current = s;
    setPsa(s);
    setMetrics({});
    setSaved(false);
    beginRun('A');
  };

  const choose = async (c: 'A' | 'B') => {
    const next = pickAB(psa!, c);
    psaRef.current = next;
    setPsa(next);
    setMetrics({});
    if (isDone(next)) {
      setPhase('done');
      const st = useSettings.getState();
      const fin = psaResult(next);
      await savePsaResult({
        createdAt: Date.now(),
        startSens: next.base,
        finalSens: fin,
        cm360: cmPer360(st.dpi, fin, st.mYaw),
        dpi: st.dpi,
        yaw: st.mYaw,
        rounds: next.history.map(({ round, lo, hi, picked }) => ({ round, lo, hi, picked }))
      });
      setSaved(true);
    } else beginRun('A');
  };

  const fin = psa ? psaResult(psa) : null;
  return (
    <div className="card">
      <h3>PSA 找灵敏度（盲测 A/B）</h3>
      <p className="muted">
        从当前灵敏度 {settings.sens} 出发，区间为 ±{Math.round(spread * 100)}%。每轮分别用两组隐藏标签的灵敏度完成一次小任务（{6} 个甩枪目标 + 4 秒跟枪），选出手感更好的一组；区间每轮减半，共 {rounds} 轮。
        浏览器帧率、显示延迟与游戏不同，结果仅作起点，请回到 CS2 中再确认。
      </p>
      {phase === 'idle' || phase === 'done' ? (
        <div className="row">
          <label>
            初始区间 ±
            <select value={spread} onChange={(e) => setSpread(Number(e.target.value))}>
              {[0.25, 0.5, 0.75].map((v) => (
                <option key={v} value={v}>{v * 100}%</option>
              ))}
            </select>
          </label>
          <label>
            轮数
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[5, 6, 7, 8].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={showMetrics} onChange={(e) => setShowMetrics(e.target.checked)} /> 选择时显示客观数据
          </label>
          <button onClick={start}>{phase === 'done' ? '重新开始' : '开始'}</button>
        </div>
      ) : (
        <div className="muted">第 {(psa?.round ?? 0) + 1} / {psa?.maxRounds} 轮　当前阶段：{phase === 'choose' ? '选择' : `候选 ${phase}`}</div>
      )}
      <canvas ref={canvasRef} width={960} height={420} className="stage" />
      {phase === 'choose' && (
        <div className="row">
          <button onClick={() => choose('A')}>A 手感更好</button>
          <button onClick={() => choose('B')}>B 手感更好</button>
          {showMetrics && (
            <div className="muted">
              <div>A：{fmtM(metrics.A)}</div>
              <div>B：{fmtM(metrics.B)}</div>
            </div>
          )}
        </div>
      )}
      {phase === 'done' && fin != null && (
        <div className="banner">
          结果：灵敏度 <b>{fin}</b>（cm/360 = {cmPer360(settings.dpi, fin, settings.mYaw).toFixed(2)} cm，DPI {settings.dpi}）{saved && '，已保存到记录'}
          <button style={{ marginLeft: 12 }} onClick={() => settings.set({ sens: fin })}>
            应用为当前灵敏度
          </button>
          <details>
            <summary>每轮区间</summary>
            <ol>
              {psa!.history.map((h) => (
                <li key={h.round}>
                  [{h.lo.toFixed(3)}, {h.hi.toFixed(3)}] → 选了{h.picked === 'low' ? '较低' : '较高'}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
