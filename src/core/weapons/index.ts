// 武器数据类型与加载（数据文件位于 public/data/weapons/）

export interface PatternPoint {
  shot: number; // 1..N
  x: number; // 子弹相对初始瞄准点的累计偏移，水平（度，+右）
  y: number; // 垂直（度，+上 = 子弹上跳）
}

export interface WeaponData {
  id: string;
  name: string;
  isDemo: boolean;
  demoNotice?: string;
  gameBuild?: string;
  cycleTime: number; // 秒
  clipSize: number;
  recovery?: Record<string, number>;
  sources: Record<string, string>;
  perBullet: PatternPoint[]; // 真实数据为空时表示尚未实测
  notes?: string[];
  vdataClass?: string;
  fullAuto?: boolean;
  /** weapons.vdata 原始引擎参数（[主模式, 副模式]），不是角度，不能直接当弹道/散布用 */
  recoilParams?: Record<string, number | number[]>;
  accuracyParams?: Record<string, number | number[]>;
  validationTargets?: Record<string, number>;
}

export interface WeaponIndexEntry {
  id: string;
  file: string;
  label: string;
  isDemo: boolean;
}

const base = import.meta.env.BASE_URL;

export async function loadWeaponIndex(): Promise<WeaponIndexEntry[]> {
  const r = await fetch(`${base}data/weapons/index.json`);
  if (!r.ok) throw new Error('无法加载武器列表');
  return r.json();
}

export async function loadWeapon(file: string): Promise<WeaponData> {
  const r = await fetch(`${base}data/weapons/${file}`);
  if (!r.ok) throw new Error(`无法加载 ${file}`);
  return r.json();
}

/** 理想补偿 = 弹道取反（视角需要移动的累计角度） */
export function compensationOf(pattern: PatternPoint[]) {
  return pattern.map((p) => ({ shot: p.shot, x: -p.x, y: -p.y }));
}

export const hasPattern = (w: WeaponData) => w.perBullet.length > 0;
