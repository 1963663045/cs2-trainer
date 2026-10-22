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
  if (!r.ok) throw new Error(`无法加载武器列表（HTTP ${r.status}）`);
  return r.json();
}

export async function loadWeapon(file: string): Promise<WeaponData> {
  const r = await fetch(`${base}data/weapons/${file}`);
  if (!r.ok) throw new Error(`无法加载 ${file}（HTTP ${r.status}）`);
  return validateWeapon(await r.json(), file);
}

/** 基本结构校验：数据文件被手工替换时尽早给出明确错误，而不是在画布里出 NaN */
export function validateWeapon(d: unknown, file = '数据'): WeaponData {
  const w = d as WeaponData;
  const bad = (m: string) => new Error(`${file} 格式错误：${m}`);
  if (!w || typeof w !== 'object') throw bad('不是对象');
  if (typeof w.id !== 'string' || typeof w.name !== 'string') throw bad('缺少 id / name');
  if (!(typeof w.cycleTime === 'number' && w.cycleTime > 0 && w.cycleTime < 5)) throw bad('cycleTime 必须是 0–5 秒的正数');
  if (!(Number.isInteger(w.clipSize) && w.clipSize > 0 && w.clipSize <= 200)) throw bad('clipSize 必须是 1–200 的整数');
  if (!Array.isArray(w.perBullet)) throw bad('perBullet 必须是数组（可为空）');
  w.perBullet.forEach((p, i) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw bad(`perBullet[${i}] 缺少有效的 x / y`);
  });
  if (w.perBullet.length > w.clipSize) throw bad('perBullet 发数超过 clipSize');
  return { ...w, isDemo: !!w.isDemo, sources: w.sources ?? {} };
}

/** 理想补偿 = 弹道取反（视角需要移动的累计角度） */
export function compensationOf(pattern: PatternPoint[]) {
  return pattern.map((p) => ({ shot: p.shot, x: -p.x, y: -p.y }));
}

export const hasPattern = (w: WeaponData) => w.perBullet.length > 0;
