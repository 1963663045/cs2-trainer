import { describe, expect, it } from 'vitest';
import { MicroTask } from './microTask';

describe('MicroTask', () => {
  it('命中、超时与跟枪流程', () => {
    const t = new MicroTask(0.022, () => 0.5, { flickTargets: 2, flickTimeoutMs: 1000, targetRadiusDeg: 1, trackMs: 500 });
    t.update(0); // 生成第 1 个目标
    t.click(10); // 未瞄准 → miss
    const need = (t.target.yaw - t.yaw) / 0.022;
    t.move(need, 0);
    t.click(300); // 命中
    t.update(1400); // 第 2 个目标超时 → miss，进入跟枪
    expect(t.phase).toBe('track');
    t.update(1600);
    t.update(1900);
    expect(t.done).toBe(true);
    const m = t.metrics();
    expect(m.hits).toBe(1);
    expect(m.misses).toBe(2);
    expect(m.flickMeanMs).toBe(300);
    expect(m.trackMeanErrDeg).toBeGreaterThan(0);
  });
});
