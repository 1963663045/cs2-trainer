// 鼠标输入层：Pointer Lock + 原始输入（unadjustedMovement），只读取用户自己的鼠标移动。
// 不会、也不能向系统或游戏发送任何输入。
import { E2E, e2eHook } from './e2e';

export type RawStatus = 'unlocked' | 'raw' | 'os-accel' | 'unsupported';
export type UnlockReason = 'esc' | 'blur' | 'hidden' | 'program';

export interface MoveSample {
  t: number; // performance.now() 时间基准（ms）
  dx: number; // 鼠标计数（counts）
  dy: number;
  buttons?: number; // 事件中的按键位掩码（1 = 左键按下）；未知时为 undefined
}

/**
 * 单个事件的位移上限（counts）。Chrome 在锁定瞬间/部分系统下会偶发一个巨大的 movementX/Y（已知 bug），
 * 正常人手在 1000 Hz 回报率下单个报告很难超过几百 counts，因此超过上限的事件直接丢弃并计数。
 */
export const MAX_COUNTS_PER_EVENT = 1000;

export const isSpike = (dx: number, dy: number, limit = MAX_COUNTS_PER_EVENT) =>
  !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > limit || Math.abs(dy) > limit;

type Listener = (s: MoveSample) => void;
type LockListener = (e: { locked: boolean; reason?: UnlockReason }) => void;

/** 把浏览器异常转成中文提示 */
export function lockErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'SecurityError' || name === 'InvalidStateError')
    return '浏览器拒绝了鼠标锁定：刚按过 Esc 后需要等约 1 秒再点击画布；或页面不在前台。';
  if (name === 'WrongDocumentError') return '画布不在当前页面中，无法锁定。';
  return `无法锁定鼠标：${name ?? String(e)}`;
}

/** 等待一次 pointerlockchange / pointerlockerror（用于不返回 Promise 的旧浏览器） */
function waitLockEvent(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (ok: boolean) => {
      document.removeEventListener('pointerlockchange', onOk);
      document.removeEventListener('pointerlockerror', onErr);
      clearTimeout(timer);
      if (ok) resolve();
      else reject(Object.assign(new Error('pointerlockerror'), { name: 'SecurityError' }));
    };
    const onOk = () => done(true);
    const onErr = () => done(false);
    const timer = setTimeout(() => done(!!document.pointerLockElement), timeoutMs);
    document.addEventListener('pointerlockchange', onOk);
    document.addEventListener('pointerlockerror', onErr);
  });
}

export class PointerInput {
  status: RawStatus = 'unlocked';
  usingRawUpdate = false;
  stats = { events: 0, dropped: 0 };
  lastError: string | null = null;
  private el: HTMLElement | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: RawStatus) => void>();
  private lockListeners = new Set<LockListener>();
  private errorListeners = new Set<(msg: string) => void>();
  /** 本次锁定是否确认为原始输入 */
  private mode: 'raw' | 'os' = 'os';
  private wasLocked = false;
  private pendingReason: UnlockReason | null = null;
  private fakeLocked = false; // 仅 E2E 测试构建使用

  constructor() {
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  dispose() {
    this.detach();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (E2E && e2eHook() && e2eHook()!.active === this) e2eHook()!.active = null;
    this.listeners.clear();
    this.statusListeners.clear();
    this.lockListeners.clear();
    this.errorListeners.clear();
  }

  onMove(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onStatus(fn: (s: RawStatus) => void) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
  /** 锁定 / 解锁事件；解锁时带原因（esc / blur / hidden / program） */
  onLock(fn: LockListener) {
    this.lockListeners.add(fn);
    return () => this.lockListeners.delete(fn);
  }
  onError(fn: (msg: string) => void) {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn);
  }

  get locked() {
    return this.fakeLocked || (!!this.el && document.pointerLockElement === this.el);
  }

  /** 必须在用户手势（点击）中调用 */
  async lock(el: HTMLElement): Promise<RawStatus> {
    if (this.locked) return this.status;
    if (document.visibilityState === 'hidden') return this.status;
    this.el = el;
    this.lastError = null;
    const hook = E2E ? e2eHook() : null;
    if (hook?.fakeLock) {
      // 测试构建：不调用真实 Pointer Lock，由测试脚本注入移动
      this.fakeLocked = true;
      this.mode = hook.fakeMode === 'os' ? 'os' : 'raw';
      hook.active = this;
      this.handleLocked();
      return this.status;
    }
    if (typeof el.requestPointerLock !== 'function') {
      this.setStatus('unsupported');
      return this.status;
    }
    const request = async (opts?: { unadjustedMovement: boolean }) => {
      const r = (el.requestPointerLock as (o?: unknown) => Promise<void> | undefined).call(el, opts);
      if (r && typeof (r as Promise<void>).then === 'function') {
        await r;
        return true; // 支持 Promise 的实现才会校验 unadjustedMovement
      }
      await waitLockEvent();
      return false; // 旧实现会静默忽略选项，无法确认是否为原始输入
    };
    try {
      // 必须在请求前设定 mode：pointerlockchange 可能先于 Promise 完成触发
      this.mode = 'raw';
      const confirmed = await request({ unadjustedMovement: true });
      if (!confirmed) {
        this.mode = 'os';
        if (this.locked) this.setStatus('os-accel');
      }
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'NotSupportedError' || name === 'TypeError') {
        // 浏览器 / 平台不支持 unadjustedMovement：降级为普通锁定（受系统加速影响）
        this.mode = 'os';
        try {
          await request();
        } catch (e2) {
          this.fail(e2);
        }
      } else this.fail(e);
    }
    return this.status;
  }

  unlock(reason: UnlockReason = 'program') {
    if (!this.locked) return;
    this.pendingReason = reason;
    if (this.fakeLocked) {
      this.fakeLocked = false;
      this.handleUnlocked();
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** 测试构建专用：注入一次移动（走与真实事件相同的过滤流程） */
  injectMove(dx: number, dy: number, buttons?: number, t = performance.now()) {
    if (!E2E || !this.locked) return;
    this.emit({ t, dx, dy, buttons });
  }

  private fail(e: unknown) {
    const msg = lockErrorMessage(e);
    this.lastError = msg;
    for (const fn of this.errorListeners) fn(msg);
  }

  private onLockChange = () => {
    if (this.fakeLocked) return;
    const now = !!this.el && document.pointerLockElement === this.el;
    if (now && !this.wasLocked) this.handleLocked();
    else if (!now && this.wasLocked) this.handleUnlocked();
  };

  private handleLocked() {
    this.wasLocked = true;
    this.pendingReason = null;
    this.attach();
    this.setStatus(this.mode === 'raw' ? 'raw' : 'os-accel');
    for (const fn of this.lockListeners) fn({ locked: true });
  }

  private handleUnlocked() {
    this.wasLocked = false;
    this.detach();
    const reason = this.pendingReason ?? 'esc'; // 非程序触发的解锁基本都是 Esc
    this.pendingReason = null;
    this.setStatus('unlocked');
    for (const fn of this.lockListeners) fn({ locked: false, reason });
  }

  private onBlur = () => this.unlock('blur');
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.unlock('hidden');
  };

  private attach() {
    const el = this.el;
    if (!el || this.fakeLocked) return;
    this.usingRawUpdate = 'onpointerrawupdate' in el;
    if (this.usingRawUpdate) el.addEventListener('pointerrawupdate' as 'pointermove', this.onPointer);
    else el.addEventListener('pointermove', this.onPointer);
  }

  private detach() {
    if (!this.el) return;
    this.el.removeEventListener('pointerrawupdate' as 'pointermove', this.onPointer);
    this.el.removeEventListener('pointermove', this.onPointer);
  }

  private onPointer = (e: PointerEvent) => {
    // pointermove 会被浏览器合并，取回被合并的事件以保留高回报率的细节；pointerrawupdate 本身不合并
    const events = !this.usingRawUpdate && typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = events.length ? events : [e];
    for (const ev of list) {
      // 事件的 timeStamp 与 performance.now() 同一时间基准
      this.emit({ t: ev.timeStamp || performance.now(), dx: ev.movementX, dy: ev.movementY, buttons: e.buttons });
    }
  };

  private emit(s: MoveSample) {
    this.stats.events++;
    if (isSpike(s.dx, s.dy)) {
      this.stats.dropped++;
      return;
    }
    for (const fn of this.listeners) fn(s);
  }

  private setStatus(s: RawStatus) {
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }
}

export const STATUS_LABEL: Record<RawStatus, string> = {
  unlocked: '未锁定',
  raw: '原始输入 ✓',
  'os-accel': '非原始输入',
  unsupported: '不支持锁定'
};
