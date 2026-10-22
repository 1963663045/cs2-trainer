import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RafLoop } from './loop';

let queue: ((t: number) => void)[] = [];
beforeEach(() => {
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => queue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
});
afterEach(() => vi.unstubAllGlobals());
const flush = () => {
  const q = queue;
  queue = [];
  q.forEach((cb) => cb(0));
};

describe('RafLoop', () => {
  it('空闲时只绘制一帧，需要时持续', () => {
    let keep = false;
    const loop = new RafLoop(() => keep);
    loop.kick();
    loop.kick(); // 重复 kick 不会排多帧
    expect(queue.length).toBe(1);
    flush();
    expect(loop.frames).toBe(1);
    expect(queue.length).toBe(0);
    keep = true;
    loop.kick();
    flush();
    flush();
    expect(loop.frames).toBe(3);
    expect(queue.length).toBe(1);
    loop.dispose();
    loop.kick();
    expect(queue.length).toBe(0);
  });
});
