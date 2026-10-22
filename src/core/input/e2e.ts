// E2E 测试钩子：只在 VITE_E2E=1 的测试构建中启用；生产构建中 E2E 为常量 false，相关代码会被移除。
// 钩子只能向本页面自己的输入层注入「模拟的鼠标移动」用于自动化测试，与游戏无关。
import type { PointerInput } from './pointerInput';

export const E2E = import.meta.env.VITE_E2E === '1';

export interface E2EHook {
  fakeLock: boolean;
  /** 假锁定时模拟的输入模式：'raw'（默认）或 'os'（模拟不支持 unadjustedMovement 的平台） */
  fakeMode?: 'raw' | 'os';
  active: PointerInput | null;
  move: (dx: number, dy: number, buttons?: number) => void;
  unlock: () => void;
  psaTask?: () => unknown;
}

declare global {
  interface Window {
    __cs2e2e?: E2EHook;
  }
}

export function e2eHook(): E2EHook | null {
  return E2E && typeof window !== 'undefined' ? window.__cs2e2e ?? null : null;
}

export function installE2EHook() {
  if (!E2E) return;
  const hook: E2EHook = {
    fakeLock: true,
    active: null,
    move: (dx, dy, buttons = 1) => hook.active?.injectMove(dx, dy, buttons),
    unlock: () => hook.active?.unlock('esc')
  };
  window.__cs2e2e = hook;
}
