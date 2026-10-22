import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { GAMES, cmPer360, convertSens, countsToDeg, edpi, fmt, horizontalFov, isPos, verticalFov, CM_PER_INCH } from '../core/sens';
import { RafLoop } from '../render/loop';
import { usePointerInput } from '../components/usePointerInput';
import PsaFinder from '../components/PsaFinder';

function Calibration() {
  const { sens, mYaw, dpi } = useSettings();
  const input = usePointerInput();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counts = useRef({ x: 0 });
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const inp = input.current!;
    const offMove = inp.onMove((s) => {
      counts.current.x += s.dx;
    });
    const offLock = inp.onLock((e) => {
      setLocked(e.locked);
      loop.kick();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.key === 'r' || e.key === 'R') && inp.locked) {
        counts.current.x = 0;
        loop.kick();
      }
    };
    window.addEventListener('keydown', onKey);
    const loop = new RafLoop(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return false;
      const { sens: sv, mYaw: y, dpi: d } = useSettings.getState();
      const deg = countsToDeg(counts.current.x, sv, y);
      const cm = (Math.abs(counts.current.x) / d) * CM_PER_INCH;
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, c.width, c.height);
      const cx = c.width / 2;
      const cy = c.height / 2 + 10;
      const r = 90;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (Number.isFinite(deg)) {
        const a = ((deg % 360) * Math.PI) / 180 - Math.PI / 2;
        ctx.strokeStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '16px sans-serif';
      ctx.fillText(`累计转角：${fmt(deg, 1)}°（${fmt(deg / 360, 3)} 圈）`, 16, 26);
      ctx.fillText(`鼠标水平移动：${fmt(cm)} cm`, 16, 48);
      if (!inp.locked) {
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('点击画布锁定鼠标', 16, c.height - 16);
      }
      return inp.locked;
    });
    const offSettings = useSettings.subscribe(loop.kick);
    loop.kick();
    return () => {
      loop.dispose();
      offMove();
      offLock();
      offSettings();
      window.removeEventListener('keydown', onKey);
    };
  }, [input]);

  const target = cmPer360(dpi, sens, mYaw);
  return (
    <div className="card">
      <h3>360° 校准测试</h3>
      <p className="muted">
        点击下方画布锁定鼠标，在鼠标垫上水平移动；按当前设置，转满 360° 理论上需要 <b>{fmt(target)} cm</b>。可在 CS2 中用同样距离转身对照。快捷键：R 归零，Esc 退出锁定。
      </p>
      <canvas
        ref={canvasRef}
        width={640}
        height={260}
        className="stage"
        role="img"
        aria-label="360 度校准画布"
        data-testid="calib-canvas"
        onClick={(e) => {
          if (!input.current!.locked) input.current!.lock(e.currentTarget);
        }}
      />
      <div>
        <button type="button" onClick={() => (counts.current.x = 0)}>归零</button> {locked ? '已锁定' : '点击画布开始'}
      </div>
    </div>
  );
}

export default function Sens() {
  const s = useSettings();
  const [from, setFrom] = useState('cs2');
  const [value, setValue] = useState(s.sens);
  const [toDpi, setToDpi] = useState(s.dpi);
  const fromGame = GAMES.find((g) => g.id === from)!;
  return (
    <div className="page">
      <h2>灵敏度</h2>
      <div className="card">
        <div>eDPI = DPI × 灵敏度 = <b data-testid="sens-edpi">{fmt(edpi(s.dpi, s.sens), 0)}</b></div>
        <div>cm/360 = 360 ÷ (灵敏度 × m_yaw) ÷ DPI × 2.54 = <b data-testid="sens-cm360">{fmt(cmPer360(s.dpi, s.sens, s.mYaw))} cm</b></div>
        <div>
          Hor+ 视野：4:3 → <b>{horizontalFov(4 / 3).toFixed(2)}°</b>，16:10 → <b>{horizontalFov(16 / 10).toFixed(2)}°</b>，16:9 → <b>{horizontalFov(16 / 9).toFixed(2)}°</b>；垂直视野 {verticalFov().toFixed(2)}°
        </div>
      </div>
      <div className="card">
        <h3>跨游戏换算（保持 cm/360）</h3>
        <div className="row">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {GAMES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input type="number" step={0.01} min={0} aria-label="原游戏灵敏度" data-testid="conv-sens" value={value} onChange={(e) => setValue(parseFloat(e.target.value))} />
          <span>@ {s.dpi} DPI → 目标 DPI</span>
          <input type="number" min={1} aria-label="目标 DPI" data-testid="conv-dpi" value={toDpi} onChange={(e) => setToDpi(parseFloat(e.target.value))} />
          {!(isPos(value) && isPos(toDpi)) && <span className="err">请输入大于 0 的灵敏度和 DPI</span>}
        </div>
        <table>
          <thead>
            <tr>
              <th>游戏</th>
              <th>yaw</th>
              <th>换算灵敏度</th>
              <th>cm/360</th>
            </tr>
          </thead>
          <tbody>
            {GAMES.map((g) => {
              const v = convertSens(value, fromGame.yaw, g.yaw, s.dpi, toDpi);
              return (
                <tr key={g.id} data-testid={`conv-${g.id}`}>
                  <td>{g.name}</td>
                  <td>{g.yaw}</td>
                  <td>{fmt(v, 4)}</td>
                  <td>{fmt(cmPer360(toDpi, v, g.yaw))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <small className="muted">只包含能核实 yaw 常数的游戏。换算只匹配腰射转身速度，开镜/ADS 倍率与视野差异需另行调整。</small>
      </div>
      <Calibration />
      <PsaFinder />
    </div>
  );
}
