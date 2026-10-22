import { useState } from 'react';
import { DEFAULTS, useSettings } from '../store/settings';
import { cmPer360, edpi, fmt, horizontalFov, renderAspectOf, validateNumber, type AspectMode, type NumericKey } from '../core/sens';

const ASPECTS: { v: AspectMode; label: string }[] = [
  { v: '16:9', label: '16:9 原生' },
  { v: '16:10', label: '16:10' },
  { v: '4:3-stretched', label: '4:3 拉伸' },
  { v: '4:3-blackbars', label: '4:3 黑边' }
];

/** 数字输入：本地保留字符串（允许输入到一半），合法时才写入设置，非法时显示原因 */
function Num(props: { k: NumericKey; label: string; step?: number; hint?: string }) {
  const value = useSettings((s) => s[props.k]);
  const set = useSettings((s) => s.set);
  const [text, setText] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  // 设置被外部改变（如「恢复默认」）时同步输入框：渲染期间按前值比较（React 推荐的派生状态写法）
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (parseFloat(text) !== value) setText(String(value));
    setErr(null);
  }
  const id = `f-${props.k}`;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        step={props.step ?? 1}
        aria-invalid={!!err}
        aria-describedby={`${id}-hint`}
        data-testid={id}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          const msg = validateNumber(props.k, v);
          setErr(msg);
          if (!msg) set({ [props.k]: v, configured: true });
        }}
        onBlur={() => {
          if (err) {
            setText(String(value));
            setErr(null);
          }
        }}
      />
      <small id={`${id}-hint`} className={err ? 'err' : undefined}>{err ?? props.hint ?? ''}</small>
    </div>
  );
}

export default function Home() {
  const s = useSettings();
  const hfov = horizontalFov(renderAspectOf(s.aspect));
  return (
    <div className="page">
      <h2>设置</h2>
      <p className="muted">
        请按你在 CS2 里的实际设置填写：DPI（鼠标驱动里看）、灵敏度（CS2 设置或控制台 <code>sensitivity</code>）。所有设置保存在本机浏览器（localStorage），不会上传。
      </p>
      <div className="grid">
        <Num k="dpi" label="鼠标 DPI" hint="网页无法读取鼠标固件中的 DPI，请按驱动设置填写" />
        <Num k="sens" label="CS2 灵敏度 (sensitivity)" step={0.01} hint="与游戏内一致" />
        <Num k="mYaw" label="m_yaw / m_pitch" step={0.001} hint="CS2 默认 0.022，一般不用改" />
        <Num k="resW" label="分辨率宽" hint="仅用于记录与说明" />
        <Num k="resH" label="分辨率高" />
        <div className="field">
          <label htmlFor="f-aspect">画面比例</label>
          <select id="f-aspect" data-testid="f-aspect" value={s.aspect} onChange={(e) => s.set({ aspect: e.target.value as AspectMode, configured: true })}>
            {ASPECTS.map((a) => (
              <option key={a.v} value={a.v}>
                {a.label}
              </option>
            ))}
          </select>
          <small>影响训练画面的横向比例（4:3 拉伸会横向放大）</small>
        </div>
        <Num k="toleranceDeg" label="单发容差（度）" step={0.1} hint="误差达到该值时单发 0 分；也是黄色容差圈半径" />
        <div className="field">
          <label>
            <input type="checkbox" checked={s.showGuide} onChange={(e) => s.set({ showGuide: e.target.checked })} /> 训练时显示理想补偿线
          </label>
        </div>
      </div>
      <div className="card" data-testid="home-derived">
        <div>eDPI：<b data-testid="home-edpi">{fmt(edpi(s.dpi, s.sens), 0)}</b></div>
        <div>cm/360：<b data-testid="home-cm360">{fmt(cmPer360(s.dpi, s.sens, s.mYaw))} cm</b></div>
        <div>
          游戏内水平视野（Hor+）：<b data-testid="home-hfov">{fmt(hfov)}°</b>
          {s.aspect === '4:3-stretched' && '（4:3 渲染后横向拉伸到显示器）'}
          {s.aspect === '4:3-blackbars' && '（4:3 渲染，两侧黑边）'}
        </div>
      </div>
      <div className="row">
        {!s.configured && (
          <button type="button" onClick={() => s.set({ configured: true })}>
            使用以上设置
          </button>
        )}
        <button type="button" onClick={() => s.reset()}>
          恢复默认（{DEFAULTS.dpi} DPI / {DEFAULTS.sens}）
        </button>
      </div>
    </div>
  );
}
