import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AspectMode } from '../core/sens';
import type { RawStatus } from '../core/input/pointerInput';

export interface Settings {
  dpi: number;
  sens: number;
  mYaw: number;
  resW: number;
  resH: number;
  aspect: AspectMode;
  toleranceDeg: number;
  showGuide: boolean;
  /** 显示容差圈（半径 = toleranceDeg，设置值） */
  showTolerance: boolean;
  /** 停火恢复近似（默认关闭）：未完全恢复时重新开火，从衰减后的弹道序号继续 */
  recoveryApprox: boolean;
}

interface SettingsState extends Settings {
  set: (p: Partial<Settings>) => void;
  reset: () => void;
}

export const DEFAULTS: Settings = {
  dpi: 800,
  sens: 1.0,
  mYaw: 0.022,
  resW: 1920,
  resH: 1080,
  aspect: '16:9',
  toleranceDeg: 1.5,
  showGuide: true,
  showTolerance: true,
  recoveryApprox: false
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (p) => set(p),
      reset: () => set(DEFAULTS)
    }),
    { name: 'cs2-trainer-settings', version: 1 }
  )
);

// 运行时状态（不持久化）：原始输入状态指示
export const useRuntime = create<{ raw: RawStatus; setRaw: (s: RawStatus) => void }>()((set) => ({
  raw: 'unlocked',
  setRaw: (raw) => set({ raw })
}));
