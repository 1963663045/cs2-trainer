import type { WeaponData, WeaponIndexEntry } from '../core/weapons';

export function WeaponSelect(props: { list: WeaponIndexEntry[]; value: string; onChange: (id: string) => void }) {
  return (
    <label>
      武器：
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.list.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WeaponNotice({ weapon }: { weapon: WeaponData | null }) {
  if (!weapon) return null;
  if (weapon.isDemo) return <div className="banner demo">⚠️ {weapon.demoNotice ?? '示意数据，非游戏真实弹道'}：仅用于测试界面与评分流程，请勿用来记忆真实压枪。</div>;
  if (weapon.perBullet.length === 0)
    return (
      <div className="banner info">
        {weapon.name}：射速 {Math.round(60 / weapon.cycleTime)} RPM、弹匣 {weapon.clipSize} 发来自游戏文件 weapons.vdata；逐发弹道<b>待实测</b>（为空），本页只记录你的鼠标轨迹与计时，不评分。
        <ParamDetails weapon={weapon} />
      </div>
    );
  return null;
}

const fmt = (v: unknown) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

function ParamDetails({ weapon }: { weapon: WeaponData }) {
  const groups: [string, Record<string, unknown> | undefined][] = [
    ['恢复时间（秒 / 发序号）', weapon.recovery],
    ['后坐力原始参数', weapon.recoilParams],
    ['精度原始参数', weapon.accuracyParams]
  ];
  return (
    <details>
      <summary>vdata 原始参数（{weapon.gameBuild ?? '未知版本'}）</summary>
      <p className="muted">数组为 [主模式, 副模式]；这些是引擎内部参数，单位未由 Valve 公开，不能直接换算成弹道或散布角。</p>
      {groups.map(([title, g]) =>
        g ? (
          <div key={title}>
            <b>{title}</b>
            <ul>
              {Object.entries(g).map(([k, v]) => (
                <li key={k}><code>{k}</code> = {fmt(v)}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}
      {weapon.notes?.length ? <ul>{weapon.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
    </details>
  );
}
