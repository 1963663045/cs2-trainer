// PSA 找灵敏度（盲测 A/B）。画布逻辑在 rAF 中运行，React 只管阶段切换。
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { usePointerInput } from './usePointerInput';
import { candidates, initPsa, isDone, pickAB, psaResult, type PsaState } from '../core/sens/psa';
import { DEFAULT_TASK, MicroTask, type MicroTaskMetrics } from '../core/sens/microTask';
import { cmPer360, fmt, isPos, stretchFactor } from '../core/sens';
import { savePsaResult } from '../core/replay/db';
import { drawMicroTask } from '../render/psaCanvas';
import { gameScalePxPerDeg } from '../render/sprayCanvas';
import { RafLoop } from '../render/loop';
import { E2E, e2eHook } from '../core/input/e2e';

type Phase = 'idle' | 'A' | 'B' | 'choose' | 'done';

const fmtM = (m?: MicroTaskMetrics) =>
  m
    ? `命中 ${m.hits}/${m.hits + m.timeouts}，超时 ${m.timeouts}，空枪 ${m.missClicks}，甩枪平均 ${m.flickMeanMs ? m.flickMeanMs.toFixed(0) + ' ms' : '—'}，跟枪平均误差 ${m.trackMeanErrDeg != null ? m.trackMeanErrDeg.toFixed(2) + '°' : '—'}`
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
  const loopRef = useRef<RafLoop | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const psaRef = useRef<PsaState | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    psaRef.current = psa;
  }, [psa]);

  const beginRun = (p: 'A' | 'B') => {
    const s = psaRef.current!;
    const c = candidates(s);
    const sens = p === 'A' ? c.a : c.b;
    taskRef.current = new MicroTask(sens * useSettings.getState().mYaw);
    phaseRef.current = p;
    setPhase(p);
    loopRef.current?.kick();
  };

  useEffect(() => {
    const inp = input.current!;
    const canvas = canvasRef.current!;
    const offMove = inp.onMove((s) => taskRef.current?.move(s.dx, s.dy));
    const restartRun = () => {
      const ph = phaseRef.current;
      if (ph === 'A' || ph === 'B') beginRun(ph);
    };
    const offLock = inp.onLock((e) => {
      // 小任务进行中解除锁定：本组作废，重新锁定后从头开始（避免计时被暂停时间污染）
      if (!e.locked) restartRun();
      loop.kick();
    });
    const offErr = inp.onError((m) => setNotice(m));
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const ph = phaseRef.current;
      if (ph !== 'A' && ph !== 'B') return;
      if (!inp.locked) {
        inp.lock(canvas);
        return;
      }
      taskRef.current?.click(e.timeStamp || performance.now());
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r' || e.key === 'R') restartRun();
    };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    const loop = new RafLoop((now) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const ph = phaseRef.current;
      const task = taskRef.current;
      const st = useSettings.getState();
      const ppd = gameScalePxPerDeg(canvas);
      const sx = stretchFactor(st.aspect, screen.width / screen.height);
      if ((ph === 'A' || ph === 'B') && task) {
        if (inp.locked) task.update(now);
        drawMicroTask(ctx, canvas.width, canvas.height, task, ppd, `候选 ${ph}（第 ${(psaRef.current?.round ?? 0) + 1} 轮）`, sx, now);
        if (!inp.locked) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`候选 ${ph}：点击画布锁定鼠标后开始（计时从锁定后开始）`, canvas.width / 2, canvas.height / 2);
          ctx.textAlign = 'start';
        }
        if (task.done) {
          const m = task.metrics();
          taskRef.current = null;
          setMetrics((old) => ({ ...old, [ph]: m }));
          if (ph === 'A') beginRun('B');
          else {
            phaseRef.current = 'choose'; // 先改 ref，避免下面的解锁事件把它当成「中途退出」而重做
            setPhase('choose');
            inp.unlock();
          }
          return true;
        }
        return inp.locked;
      }
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      const msg = ph === 'choose' ? '请在下方选择手感更好的一组' : ph === 'done' ? '已完成' : '点击「开始」进行 PSA 盲测';
      ctx.fillText(msg, 16, 24);
      return false;
    });
    loopRef.current = loop;
    loop.kick();
    if (E2E && e2eHook()) e2eHook()!.psaTask = () => taskRef.current;
    return () => {
      loop.dispose();
      loopRef.current = null;
      offMove();
      offLock();
      offErr();
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [input]);

  const start = () => {
    if (!isPos(settings.sens) || !isPos(settings.mYaw)) {
      setNotice('当前灵敏度或 m_yaw 无效，请先在「设置」页填写。');
      return;
    }
    setNotice(null);
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
        从当前灵敏度 {settings.sens} 出发，区间为 ±{Math.round(spread * 100)}%。每轮分别用两组隐藏标签的灵敏度完成一次小任务（{DEFAULT_TASK.flickTargets} 个甩枪目标，每个最多 {DEFAULT_TASK.flickTimeoutMs / 1000} 秒，超时算失误；然后 {DEFAULT_TASK.trackMs / 1000} 秒跟枪），选出手感更好的一组；区间每轮减半，共 {rounds} 轮。
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
      {notice && <div className="banner warn" role="alert">{notice}</div>}
      <canvas ref={canvasRef} width={960} height={420} className="stage" data-testid="psa-canvas" role="img" aria-label="PSA 小任务画布" />
      <p className="muted">画面比例按你的显示器高度换算（与游戏内同样的角度/像素关系）。快捷键：R 重做当前这一组，Esc 退出锁定（本组会作废重来）。</p>
      {phase === 'choose' && (
        <div className="row">
          <button type="button" onClick={() => choose('A')}>A 手感更好</button>
          <button type="button" onClick={() => choose('B')}>B 手感更好</button>
          {showMetrics && (
            <div className="muted">
              <div>A：{fmtM(metrics.A)}</div>
              <div>B：{fmtM(metrics.B)}</div>
            </div>
          )}
        </div>
      )}
      {phase === 'done' && fin != null && (
        <div className="banner info" data-testid="psa-result">
          结果：灵敏度 <b data-testid="psa-final">{fin}</b>（cm/360 = {fmt(cmPer360(settings.dpi, fin, settings.mYaw))} cm，DPI {settings.dpi}）{saved && '，已保存到记录'}
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
