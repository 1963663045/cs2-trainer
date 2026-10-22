// PSA（Perfect Sensitivity Approximation）式找灵敏度 —— 本项目自行实现。
// 区间 [lo, hi] 以当前灵敏度为中心；每轮比较 lo 与 hi 两个候选（盲测：A/B 随机对应），
// 选哪边就把另一边收缩到中点，区间每轮减半；结束后取区间中点。

export interface PsaRound {
  round: number;
  lo: number;
  hi: number;
  aIsLow: boolean;
  picked: 'low' | 'high';
}

export interface PsaState {
  base: number;
  lo: number;
  hi: number;
  round: number; // 已完成轮数
  maxRounds: number;
  aIsLow: boolean; // 本轮 A 是否对应低灵敏度
  history: PsaRound[];
}

export function initPsa(base: number, spread = 0.5, maxRounds = 7, rng: () => number = Math.random): PsaState {
  if (!(base > 0)) throw new Error('base 必须为正数');
  const s = Math.min(Math.max(spread, 0.05), 0.9);
  return { base, lo: base * (1 - s), hi: base * (1 + s), round: 0, maxRounds, aIsLow: rng() < 0.5, history: [] };
}

export const candidates = (s: PsaState) => ({
  a: s.aIsLow ? s.lo : s.hi,
  b: s.aIsLow ? s.hi : s.lo
});

export function pickAB(s: PsaState, choice: 'A' | 'B', rng: () => number = Math.random): PsaState {
  const picked: 'low' | 'high' = (choice === 'A') === s.aIsLow ? 'low' : 'high';
  return pickSide(s, picked, rng);
}

export function pickSide(s: PsaState, picked: 'low' | 'high', rng: () => number = Math.random): PsaState {
  if (isDone(s)) return s;
  const mid = (s.lo + s.hi) / 2;
  const rec: PsaRound = { round: s.round + 1, lo: s.lo, hi: s.hi, aIsLow: s.aIsLow, picked };
  return {
    ...s,
    lo: picked === 'low' ? s.lo : mid,
    hi: picked === 'low' ? mid : s.hi,
    round: s.round + 1,
    aIsLow: rng() < 0.5,
    history: [...s.history, rec]
  };
}

export const isDone = (s: PsaState) => s.round >= s.maxRounds;

/** 结果：区间中点，保留 3 位小数（CS2 控制台 sensitivity 可接受更多小数） */
export const psaResult = (s: PsaState) => Math.round(((s.lo + s.hi) / 2) * 1000) / 1000;
