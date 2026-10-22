import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK, MicroTask } from './microTask';

const opts = { flickTargets: 6, flickTimeoutMs: 1000, targetRadiusDeg: 1, trackMs: 500, readyMs: 300 };
const aim = (t: MicroTask) => t.move((t.target.yaw - t.yaw) / t.degPerCount, (t.pitch - t.target.pitch) / t.degPerCount);

describe('MicroTask 甩枪阶段', () => {
  it('默认 6 个目标', () => expect(DEFAULT_TASK.flickTargets).toBe(6));

  it('准备阶段（含锁定那一下点击）的点击不计', () => {
    const t = new MicroTask(0.022, () => 0.5, opts);
    expect(t.click(0)).toBe('ignored'); // 锁定点击：任务还没 update 过
    t.update(0);
    expect(t.phase).toBe('ready');
    expect(t.click(100)).toBe('ignored');
    t.update(299);
    expect(t.phase).toBe('ready');
    t.update(300);
    expect(t.phase).toBe('flick');
    expect(t.targetNo).toBe(1);
    expect(t.metrics().missClicks).toBe(0);
  });

  it('必须恰好处理 6 个目标才进入跟枪：空枪不跳目标，一次点击最多命中一个', () => {
    const t = new MicroTask(0.022, () => 0.3, opts);
    t.update(0);
    t.update(300);
    let now = 300;
    for (let i = 1; i <= 5; i++) {
      expect(t.targetNo).toBe(i);
      expect(t.click(++now)).toBe('miss'); // 没瞄准的点击
      expect(t.click(++now)).toBe('miss');
      expect(t.targetNo).toBe(i);
      aim(t);
      expect(t.click(++now)).toBe('hit');
      expect(t.distDeg).toBeGreaterThan(1); // 新目标至少 8° 外，同一点击不会连中
    }
    expect(t.phase).toBe('flick');
    aim(t);
    t.click(++now);
    expect(t.phase).toBe('track');
    expect(t.results).toEqual(['hit', 'hit', 'hit', 'hit', 'hit', 'hit']);
    expect(t.click(now + 1)).toBe('ignored'); // 跟枪阶段点击无效
    const m = t.metrics();
    expect(m.hits).toBe(6);
    expect(m.missClicks).toBe(10);
    expect(m.timeouts).toBe(0);
  });

  it('超时算作处理了一个目标（失误），6 个超时后进入跟枪', () => {
    const t = new MicroTask(0.022, () => 0.5, opts);
    t.update(0);
    t.update(300);
    let now = 300;
    for (let i = 0; i < 6; i++) {
      expect(t.phase).toBe('flick');
      now += 1001;
      t.update(now);
    }
    expect(t.phase).toBe('track');
    expect(t.metrics()).toMatchObject({ hits: 0, timeouts: 6, misses: 6, flickMeanMs: null });
  });

  it('只移动不点击不会推进目标（未超时前）', () => {
    const t = new MicroTask(0.022, () => 0.5, opts);
    t.update(0);
    t.update(300);
    aim(t); // 准星已经在目标上，但没点
    t.update(900);
    expect(t.targetNo).toBe(1);
  });

  it('跟枪阶段结束并给出指标', () => {
    const t = new MicroTask(0.022, () => 0.5, { ...opts, flickTargets: 1 });
    t.update(0);
    t.update(300);
    aim(t);
    t.click(400);
    t.update(600);
    t.update(901);
    expect(t.done).toBe(true);
    expect(t.metrics().flickMeanMs).toBe(100);
    expect(t.metrics().trackMeanErrDeg).toBeGreaterThan(0);
  });
});
