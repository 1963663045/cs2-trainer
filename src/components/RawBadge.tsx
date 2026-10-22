import { useMemo } from 'react';
import { STATUS_LABEL } from '../core/input/pointerInput';
import { detectOs, rawInputHint } from '../core/env';
import { useRuntime } from '../store/settings';

export function RawBadge() {
  const raw = useRuntime((s) => s.raw);
  const cls = raw === 'raw' ? 'ok' : raw === 'unlocked' ? 'idle' : 'warn';
  return (
    <span className={`badge ${cls}`} role="status" aria-live="polite" data-testid="raw-badge" title={STATUS_LABEL[raw]}>
      {STATUS_LABEL[raw]}
    </span>
  );
}

/** 非原始输入提示：固定定位的浮层，不占文档流，锁定 / 解锁时页面不会跳动 */
export function RawWarning() {
  const raw = useRuntime((s) => s.raw);
  const os = useMemo(() => detectOs(), []);
  if (raw !== 'os-accel' && raw !== 'unsupported') return null;
  return (
    <div className={`toast ${raw === 'unsupported' ? 'warn' : 'info'}`} role="status" data-testid="raw-warning">
      {rawInputHint(os, raw)}
    </div>
  );
}
