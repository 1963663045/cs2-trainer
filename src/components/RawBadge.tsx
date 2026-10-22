import { STATUS_LABEL } from '../core/input/pointerInput';
import { useRuntime } from '../store/settings';

export function RawBadge() {
  const raw = useRuntime((s) => s.raw);
  const cls = raw === 'raw' ? 'ok' : raw === 'unlocked' ? 'idle' : 'warn';
  return <span className={`badge ${cls}`}>{STATUS_LABEL[raw]}</span>;
}

export function RawWarning() {
  const raw = useRuntime((s) => s.raw);
  if (raw !== 'os-accel' && raw !== 'unsupported') return null;
  return (
    <div className="banner warn">
      当前浏览器未提供原始鼠标输入（unadjustedMovement），手感会受系统指针速度/加速影响，与 CS2（始终原始输入）不一致。
      请使用最新版 Chrome / Edge，或在 Windows 中关闭「提高指针精确度」并把指针速度设为 6/11。
    </div>
  );
}
