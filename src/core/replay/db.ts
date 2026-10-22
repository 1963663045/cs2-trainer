// 训练记录（IndexedDB，通过 Dexie）
import Dexie, { type Table } from 'dexie';
import type { PathPoint } from '../spray/sampler';
import type { ScoreResult } from '../scoring';

export interface AttemptRecord {
  id?: number;
  createdAt: number;
  weaponId: string;
  weaponName: string;
  isDemo: boolean;
  shotsFired: number;
  sens: number;
  dpi: number;
  yaw: number;
  rawInput: boolean;
  path: PathPoint[];
  viewAtShots: { x: number; y: number }[];
  score: ScoreResult | null;
}

export interface PsaResultRecord {
  id?: number;
  createdAt: number;
  startSens: number;
  finalSens: number;
  cm360: number;
  dpi: number;
  yaw: number;
  rounds: { round: number; lo: number; hi: number; picked: 'low' | 'high' }[];
}

class TrainerDB extends Dexie {
  attempts!: Table<AttemptRecord, number>;
  psaResults!: Table<PsaResultRecord, number>;
  constructor() {
    super('cs2-trainer');
    this.version(1).stores({ attempts: '++id, createdAt, weaponId' });
    this.version(2).stores({ attempts: '++id, createdAt, weaponId', psaResults: '++id, createdAt' });
  }
}

export const db = new TrainerDB();

export const saveAttempt = (a: AttemptRecord) => db.attempts.add(a);
/** 某武器最近一次有效记录（发数 ≥ minShots；旧版本可能存过 1 发的单击记录，这里跳过） */
export const latestAttempt = async (weaponId?: string, minShots = 1) => {
  const list = await (weaponId ? db.attempts.where('weaponId').equals(weaponId) : db.attempts.toCollection()).sortBy('createdAt');
  return list.filter((a) => a.shotsFired >= minShots).at(-1);
};
export const listAttempts = (limit = 200) => db.attempts.orderBy('createdAt').reverse().limit(limit).toArray();
export const clearAttempts = () => db.attempts.clear();

export const savePsaResult = (r: PsaResultRecord) => db.psaResults.add(r);
export const listPsaResults = (limit = 20) => db.psaResults.orderBy('createdAt').reverse().limit(limit).toArray();
