// 一次压枪尝试的状态机（与 React 无关）：按住左键开始，按射击间隔计数子弹，松开或打空结束。
import type { MoveSample } from '../input/pointerInput';
import { buildPath, sampleShots, shotTimes, type PathPoint } from './sampler';

export class SpraySession {
  firing = false;
  t0 = 0;
  samples: MoveSample[] = [];
  endT = 0;
  started = false;
  /** 本次从弹道第几发（0 起）开始 —— 仅在启用「恢复近似」时非 0 */
  startIndex = 0;
  constructor(public cycleTimeS: number, public clipSize: number) {}

  start(t: number, startIndex = 0) {
    this.startIndex = Math.max(0, Math.min(startIndex, this.clipSize - 1));
    this.firing = true;
    this.started = true;
    this.t0 = t;
    this.samples = [];
    this.endT = 0;
  }

  push(s: MoveSample) {
    if (this.firing) this.samples.push(s);
  }

  /** 截止时刻 now 已发射的子弹数（第一发在按下瞬间） */
  shotsAt(now: number) {
    if (!this.started) return 0;
    const end = this.firing ? now : this.endT;
    return Math.min(this.maxShots, Math.floor((end - this.t0) / (this.cycleTimeS * 1000)) + 1);
  }

  get maxShots() {
    return this.clipSize - this.startIndex;
  }

  /** 打空后再等一个射击间隔即自动结束 */
  isEmpty(now: number) {
    return this.firing && now - this.t0 >= this.maxShots * this.cycleTimeS * 1000;
  }

  stop(t: number) {
    this.firing = false;
    this.endT = t;
  }

  result(degPerCount: number): { path: PathPoint[]; shots: number; viewAtShots: { x: number; y: number }[] } {
    const shots = this.shotsAt(this.endT);
    const path = buildPath(this.samples, this.t0, degPerCount);
    return { path, shots, viewAtShots: sampleShots(path, shotTimes(this.cycleTimeS, shots)) };
  }

  livePath(degPerCount: number) {
    return buildPath(this.samples, this.t0, degPerCount);
  }
}
