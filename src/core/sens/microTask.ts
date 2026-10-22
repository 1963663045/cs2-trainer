// PSA 每个候选灵敏度的小任务：先「甩枪」若干目标，再「跟枪」一段时间。
// 只在角度空间里计算（度），与渲染无关。
export interface MicroTaskMetrics {
  hits: number;
  misses: number;
  flickMeanMs: number | null; // 每个命中目标的平均用时
  trackMeanErrDeg: number | null; // 跟枪阶段准星与目标的平均角距离
}

export interface MicroTaskOpts {
  flickTargets: number;
  flickTimeoutMs: number;
  targetRadiusDeg: number;
  trackMs: number;
}

export const DEFAULT_TASK: MicroTaskOpts = { flickTargets: 6, flickTimeoutMs: 2500, targetRadiusDeg: 1.2, trackMs: 4000 };

type Phase = 'flick' | 'track' | 'done';

export class MicroTask {
  yaw = 0;
  pitch = 0;
  phase: Phase = 'flick';
  target = { yaw: 0, pitch: 0 };
  private spawnT = -1;
  private flickTimes: number[] = [];
  misses = 0;
  private trackStart = -1;
  private trackCenter = 0;
  private lastT = -1;
  private errSum = 0;
  private errW = 0;
  private flicksDone = 0;

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

  private nextFlick(now: number) {
    this.flicksDone++;
    if (this.flicksDone >= this.opts.flickTargets) {
      this.phase = 'track';
      this.trackStart = now;
      this.trackCenter = this.yaw;
      this.target = { yaw: this.yaw, pitch: this.pitch };
      this.lastT = now;
    } else this.spawn(now);
  }

  click(now: number) {
    if (this.phase !== 'flick') return;
    if (this.spawnT < 0) return;
    if (this.distDeg <= this.opts.targetRadiusDeg) {
      this.flickTimes.push(now - this.spawnT);
      this.nextFlick(now);
    } else this.misses++;
  }

  update(now: number) {
    if (this.phase === 'flick') {
      if (this.spawnT < 0) this.spawn(now);
      else if (now - this.spawnT > this.opts.flickTimeoutMs) {
        this.misses++;
        this.nextFlick(now);
      }
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
    return {
      hits: n,
      misses: this.misses,
      flickMeanMs: n ? this.flickTimes.reduce((a, b) => a + b, 0) / n : null,
      trackMeanErrDeg: this.errW ? this.errSum / this.errW : null
    };
  }
}
