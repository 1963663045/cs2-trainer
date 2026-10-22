import { DEFAULTS, useSettings } from '../store/settings';
import { cmPer360, edpi, horizontalFov, renderAspectOf, type AspectMode } from '../core/sens';

const ASPECTS: { v: AspectMode; label: string }[] = [
  { v: '16:9', label: '16:9 原生' },
  { v: '16:10', label: '16:10' },
  { v: '4:3-stretched', label: '4:3 拉伸' },
  { v: '4:3-blackbars', label: '4:3 黑边' }
];

function Num(props: { label: string; value: number; step?: number; min?: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        step={props.step ?? 1}
        min={props.min ?? 0}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && v > 0) props.onChange(v);
        }}
      />
      {props.hint && <small>{props.hint}</small>}
    </label>
  );
}

export default function Home() {
  const s = useSettings();
  const hfov = horizontalFov(renderAspectOf(s.aspect));
  return (
    <div className="page">
      <h2>设置</h2>
      <p className="muted">所有设置保存在本机浏览器（localStorage），不会上传。本站只读取你自己的鼠标移动，不包含任何宏或自动压枪功能。</p>
      <div className="grid">
        <Num label="鼠标 DPI" value={s.dpi} onChange={(dpi) => s.set({ dpi })} hint="网页无法读取鼠标固件中的 DPI，请按驱动设置填写" />
        <Num label="CS2 灵敏度 (sensitivity)" value={s.sens} step={0.01} onChange={(sens) => s.set({ sens })} />
        <Num label="m_yaw / m_pitch" value={s.mYaw} step={0.001} onChange={(mYaw) => s.set({ mYaw })} hint="CS2 默认 0.022" />
        <Num label="分辨率宽" value={s.resW} onChange={(resW) => s.set({ resW })} />
        <Num label="分辨率高" value={s.resH} onChange={(resH) => s.set({ resH })} />
        <label className="field">
          <span>画面比例</span>
          <select value={s.aspect} onChange={(e) => s.set({ aspect: e.target.value as AspectMode })}>
            {ASPECTS.map((a) => (
              <option key={a.v} value={a.v}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <Num label="单发容差（度）" value={s.toleranceDeg} step={0.1} onChange={(toleranceDeg) => s.set({ toleranceDeg })} hint="误差达到该值时单发 0 分" />
        <label className="field">
          <span>训练时显示理想补偿线</span>
          <input type="checkbox" checked={s.showGuide} onChange={(e) => s.set({ showGuide: e.target.checked })} />
        </label>
      </div>
      <div className="card">
        <div>eDPI：<b>{edpi(s.dpi, s.sens).toFixed(0)}</b></div>
        <div>cm/360：<b>{cmPer360(s.dpi, s.sens, s.mYaw).toFixed(2)} cm</b></div>
        <div>游戏内水平视野（Hor+）：<b>{hfov.toFixed(2)}°</b>{s.aspect === '4:3-stretched' && '（4:3 渲染后横向拉伸显示）'}</div>
      </div>
      <button onClick={() => s.reset()}>恢复默认（{DEFAULTS.dpi} DPI / {DEFAULTS.sens}）</button>
    </div>
  );
}
