import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSpike, lockErrorMessage, MAX_COUNTS_PER_EVENT, PointerInput, type MoveSample } from './pointerInput';

// 最小 DOM 替身：document / window 用 EventTarget，元素带可控的 requestPointerLock
type Doc = EventTarget & { pointerLockElement: unknown; visibilityState: string; exitPointerLock: () => void };
let doc: Doc;

function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}) {
  const e = new Event(type);
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
  target.dispatchEvent(e);
}

function makeEl(impl: (el: EventTarget, opts?: unknown) => Promise<void> | undefined) {
  const el = new EventTarget() as EventTarget & { requestPointerLock: (o?: unknown) => Promise<void> | undefined; onpointerrawupdate?: null };
  el.requestPointerLock = (o?: unknown) => impl(el, o);
  return el;
}

/** 模拟浏览器：先触发 pointerlockchange，再让 Promise 完成（Chrome 的真实顺序） */
const grant = (el: EventTarget) => {
  doc.pointerLockElement = el;
  fire(doc, 'pointerlockchange');
  return Promise.resolve();
};
const reject = (name: string) => () => Promise.reject(Object.assign(new Error(name), { name }));

beforeEach(() => {
  doc = Object.assign(new EventTarget(), {
    pointerLockElement: null as unknown,
    visibilityState: 'visible',
    exitPointerLock() {
      doc.pointerLockElement = null;
      fire(doc, 'pointerlockchange');
    }
  });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

const asEl = (e: unknown) => e as HTMLElement;

describe('PointerInput 锁定生命周期', () => {
  it('unadjustedMovement 成功：即使 lockchange 先于 Promise 触发，也判定为原始输入', async () => {
    const inp = new PointerInput();
    const el = makeEl(grant);
    const st = await inp.lock(asEl(el));
    expect(st).toBe('raw');
    expect(inp.locked).toBe(true);
  });

  it('NotSupportedError 时降级为普通锁定（os-accel）', async () => {
    const inp = new PointerInput();
    let calls = 0;
    const el = makeEl((e, o) => {
      calls++;
      return o ? reject('NotSupportedError')() : grant(e);
    });
    expect(await inp.lock(asEl(el))).toBe('os-accel');
    expect(calls).toBe(2);
  });

  it('SecurityError（Esc 后过快重锁）给出中文提示，不误判为不支持', async () => {
    const inp = new PointerInput();
    const errs: string[] = [];
    inp.onError((m) => errs.push(m));
    const el = makeEl(reject('SecurityError'));
    expect(await inp.lock(asEl(el))).toBe('unlocked');
    expect(errs[0]).toMatch(/等约 1 秒/);
    expect(inp.lastError).toBe(errs[0]);
  });

  it('不返回 Promise 的旧实现：无法确认原始输入，按 os-accel 处理', async () => {
    const inp = new PointerInput();
    const el = makeEl((e) => {
      setTimeout(() => grant(e), 0);
      return undefined;
    });
    expect(await inp.lock(asEl(el))).toBe('os-accel');
  });

  it('解锁原因：Esc / 失焦 / 标签页隐藏 / 程序', async () => {
    const inp = new PointerInput();
    const reasons: (string | undefined)[] = [];
    inp.onLock((e) => !e.locked && reasons.push(e.reason));
    const el = makeEl(grant);
    await inp.lock(asEl(el));
    doc.exitPointerLock(); // 用户按 Esc：浏览器直接解锁
    await inp.lock(asEl(el));
    fire(window, 'blur');
    await inp.lock(asEl(el));
    doc.visibilityState = 'hidden';
    fire(doc, 'visibilitychange');
    doc.visibilityState = 'visible';
    await inp.lock(asEl(el));
    inp.unlock();
    expect(reasons).toEqual(['esc', 'blur', 'hidden', 'program']);
    expect(inp.status).toBe('unlocked');
  });

  it('页面隐藏时不请求锁定；dispose 后不再响应', async () => {
    const inp = new PointerInput();
    const spy = vi.fn(grant);
    doc.visibilityState = 'hidden';
    await inp.lock(asEl(makeEl(spy)));
    expect(spy).not.toHaveBeenCalled();
    inp.dispose();
  });
});

describe('移动事件', () => {
  it('pointermove + getCoalescedEvents 展开合并事件，并过滤异常尖峰', async () => {
    const inp = new PointerInput();
    const got: MoveSample[] = [];
    inp.onMove((s) => got.push(s));
    const el = makeEl(grant);
    await inp.lock(asEl(el));
    expect(inp.usingRawUpdate).toBe(false);
    const co = [
      { timeStamp: 1, movementX: 3, movementY: -1 },
      { timeStamp: 2, movementX: 99999, movementY: 0 }, // Chrome 偶发尖峰
      { timeStamp: 3, movementX: 4, movementY: 2 }
    ];
    fire(el, 'pointermove', { buttons: 1, timeStamp: 3, movementX: 7, movementY: 1, getCoalescedEvents: () => co });
    expect(got.map((s) => [s.t, s.dx, s.dy, s.buttons])).toEqual([
      [1, 3, -1, 1],
      [3, 4, 2, 1]
    ]);
    expect(inp.stats).toEqual({ events: 3, dropped: 1 });
  });

  it('支持 pointerrawupdate 时只监听它（不重复计数）', async () => {
    const inp = new PointerInput();
    const got: MoveSample[] = [];
    inp.onMove((s) => got.push(s));
    const el = makeEl(grant);
    (el as { onpointerrawupdate?: null }).onpointerrawupdate = null;
    await inp.lock(asEl(el));
    expect(inp.usingRawUpdate).toBe(true);
    fire(el, 'pointerrawupdate', { buttons: 0, timeStamp: 5, movementX: 2, movementY: 2 });
    fire(el, 'pointermove', { buttons: 0, timeStamp: 5, movementX: 2, movementY: 2 });
    expect(got.length).toBe(1);
  });

  it('解锁后不再接收移动', async () => {
    const inp = new PointerInput();
    const got: MoveSample[] = [];
    inp.onMove((s) => got.push(s));
    const el = makeEl(grant);
    await inp.lock(asEl(el));
    inp.unlock();
    fire(el, 'pointermove', { timeStamp: 1, movementX: 1, movementY: 1 });
    expect(got.length).toBe(0);
  });

  it('尖峰判定', () => {
    expect(isSpike(MAX_COUNTS_PER_EVENT, 0)).toBe(false);
    expect(isSpike(MAX_COUNTS_PER_EVENT + 1, 0)).toBe(true);
    expect(isSpike(0, -5000)).toBe(true);
    expect(isSpike(NaN, 0)).toBe(true);
  });

  it('错误信息', () => {
    expect(lockErrorMessage({ name: 'WrongDocumentError' })).toMatch(/不在当前页面/);
    expect(lockErrorMessage('x')).toMatch(/无法锁定/);
  });
});
