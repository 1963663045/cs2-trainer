// PSA 每个候选灵敏度的小任务：先「甩枪」固定数量的目标，再「跟枪」一段时间。
// 只在角度空间里计算（度），与渲染无关。
//
// 规则（每个目标恰好处理一次）：
// - 锁定后先有 readyMs 的准备时间，期间不生成目标、点击不计（锁定那一下点击也就不会被算进去）。
// - 每个目标要么被点中（hit），要么超时（timeout，记为失误）；两者都只让目标数 +1。
// - 没点中的点击只记为「空枪」，不会跳过目标。
// - 处理完 flickTargets 个目标后进入跟枪阶段。
export interface MicroTaskMetrics {
  hits: number;
  timeouts: number;
  missClicks: number;
  misses: number; // = timeouts + missClicks（兼容旧字段）
  flickMeanMs: number | null; // 命中目标的平均用时
  trackMeanErrDeg: number | null; // 跟枪阶段准星与目标的平均角距离
}

export interface MicroTaskOpts {
  flickTargets: number;
  flickTimeoutMs: number;
  targetRadiusDeg: number;
  trackMs: number;
  readyMs: number;
}

export const DEFAULT_TASK: MicroTaskOpts = { flickTargets: 6, flickTimeoutMs: 4000, targetRadiusDeg: 1.5, trackMs: 4000, readyMs: 800 };

type Phase = 'ready' | 'flick' | 'track' | 'done';
export type FlickResult = 'hit' | 'timeout';
export type ClickResult = 'hit' | 'miss' | 'ignored';

export class MicroTask {
  yaw = 0;
  pitch = 0;
  phase: Phase = 'ready';
  target = { yaw: 0, pitch: 0 };
  /** 每个已处理目标的结果，长度即「已处理目标数」 */
  results: FlickResult[] = [];
  missClicks = 0;
  private startT = -1;
  private spawnT = -1;
  private flickTimes: number[] = [];
  private trackStart = -1;
  private trackCenter = 0;
  private lastT = -1;
  private errSum = 0;
  private errW = 0;

  constructor(
    public degPerCount: number,
    private rng: () => number = Math.random,
    public opts: MicroTaskOpts = DEFAULT_TASK
  ) {}

  /** 鼠标原始位移（counts）→ 视角 */
  move(dx: number, dy: number) {
    this.yaw += dx * this.degPerCount;
    this.pitch = Math.max(-89, Math.min(89, this.pitch - dy * this.degPerCount));
  }

  private spawn(now: number) {
    const side = this.rng() < 0.5 ? -1 : 1;
    this.target = {
      yaw: this.yaw + side * (8 + this.rng() * 22),
      pitch: Math.max(-20, Math.min(20, this.pitch + (this.rng() * 2 - 1) * 8))
    };
    this.spawnT = now;
  }

  get distDeg() {
    return Math.hypot(this.target.yaw - this.yaw, this.target.pitch - this.pitch);
  }

  /** 当前是第几个目标（1 起）；准备阶段为 0 */
  get targetNo() {
    return this.phase === 'flick' ? this.results.length + 1 : this.phase === 'ready' ? 0 : this.opts.flickTargets;
  }

  /** 当前目标剩余时间（ms） */
  timeLeft(now: number) {
    return this.phase === 'flick' && this.spawnT >= 0 ? Math.max(0, this.opts.flickTimeoutMs - (now - this.spawnT)) : 0;
  }

  private finishTarget(r: FlickResult, now: number) {
    this.results.push(r);
    if (this.results.length >= this.opts.flickTargets) {
      this.phase = 'track';
      this.spawnT = -1;
      this.trackStart = now;
      this.trackCenter = this.yaw;
      this.target = { yaw: this.yaw, pitch: this.pitch };
      this.lastT = now;
    } else this.spawn(now);
  }

  click(now: number): ClickResult {
    if (this.phase !== 'flick' || this.spawnT < 0 || now < this.spawnT) return 'ignored';
    if (this.distDeg <= this.opts.targetRadiusDeg) {
      this.flickTimes.push(now - this.spawnT);
      this.finishTarget('hit', now);
      return 'hit';
    }
    this.missClicks++;
    return 'miss';
  }

  update(now: number) {
    if (this.phase === 'ready') {
      if (this.startT < 0) this.startT = now;
      if (now - this.startT >= this.opts.readyMs) {
        this.phase = 'flick';
        this.spawn(now);
      }
    } else if (this.phase === 'flick') {
      if (now - this.spawnT > this.opts.flickTimeoutMs) this.finishTarget('timeout', now);
    } else if (this.phase === 'track') {
      const t = (now - this.trackStart) / 1000;
      // 两个正弦叠加，速度不恒定，避免可预判
      this.target.yaw = this.trackCenter + 12 * Math.sin(t * 1.7) + 4 * Math.sin(t * 4.3);
      const dt = now - this.lastT;
      this.lastT = now;
      if (dt > 0) {
        this.errSum += this.distDeg * dt;
        this.errW += dt;
      }
      if (now - this.trackStart >= this.opts.trackMs) this.phase = 'done';
    }
  }

  get done() {
    return this.phase === 'done';
  }

  metrics(): MicroTaskMetrics {
    const n = this.flickTimes.length;
    const timeouts = this.results.filter((r) => r === 'timeout').length;
    return {
      hits: n,
      timeouts,
      missClicks: this.missClicks,
      misses: timeouts + this.missClicks,
      flickMeanMs: n ? this.flickTimes.reduce((a, b) => a + b, 0) / n : null,
      trackMeanErrDeg: this.errW ? this.errSum / this.errW : null
    };
  }
}
