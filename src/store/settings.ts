import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { validateNumber, type AspectMode, type NumericKey } from '../core/sens';
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
  /** 用户是否已确认过设置（首次使用引导） */
  configured: boolean;
}

const NUMERIC: NumericKey[] = ['dpi', 'sens', 'mYaw', 'resW', 'resH', 'toleranceDeg'];
const ASPECTS: AspectMode[] = ['16:9', '16:10', '4:3-stretched', '4:3-blackbars'];

/** 校验任意对象，返回其中合法的设置项 */
export function sanitizeSettings(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  for (const k of NUMERIC) if (validateNumber(k, r[k]) === null) (out as Record<string, unknown>)[k] = r[k];
  if (ASPECTS.includes(r.aspect as AspectMode)) out.aspect = r.aspect as AspectMode;
  for (const k of ['showGuide', 'showTolerance', 'recoveryApprox', 'configured'] as const)
    if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  return out;
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
  recoveryApprox: false,
  configured: false
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (p) => set(sanitizeSettings(p)),
      reset: () => set({ ...DEFAULTS, configured: true })
    }),
    {
      name: 'cs2-trainer-settings',
      version: 1,
      // 读取本地存储时逐项校验：被手动改坏 / 旧版本缺字段时回退到默认值
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) })
    }
  )
);

// 运行时状态（不持久化）：原始输入状态指示
export const useRuntime = create<{ raw: RawStatus; setRaw: (s: RawStatus) => void }>()((set) => ({
  raw: 'unlocked',
  setRaw: (raw) => set({ raw })
}));
