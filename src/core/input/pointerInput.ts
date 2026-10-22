// 鼠标输入层：Pointer Lock + 原始输入（unadjustedMovement），只读取用户自己的鼠标移动。
// 不会、也不能向系统或游戏发送任何输入。

export type RawStatus = 'unlocked' | 'raw' | 'os-accel' | 'unsupported';

export interface MoveSample {
  t: number; // performance.now() 时间戳（ms）
  dx: number;
  dy: number;
}

type Listener = (s: MoveSample) => void;

export class PointerInput {
  status: RawStatus = 'unlocked';
  usingRawUpdate = false;
  private el: HTMLElement | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: RawStatus) => void>();
  private wantRaw = false;

  constructor() {
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  dispose() {
    this.detach();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.listeners.clear();
    this.statusListeners.clear();
  }

  onMove(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (s: RawStatus) => void) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  get locked() {
    return !!this.el && document.pointerLockElement === this.el;
  }

  /** 必须在用户手势（点击）中调用 */
  async lock(el: HTMLElement): Promise<RawStatus> {
    this.el = el;
    if (!('requestPointerLock' in el)) {
      this.setStatus('unsupported');
      return this.status;
    }
    try {
      // Chrome/Edge 支持 unadjustedMovement：绕过系统鼠标加速，等同游戏的 raw input
      await (el.requestPointerLock as (o?: unknown) => Promise<void> | void).call(el, {
        unadjustedMovement: true
      });
      this.wantRaw = true;
    } catch {
      // Firefox/Safari 等不支持该选项时会抛 NotSupportedError，降级为普通锁定
      try {
        await (el.requestPointerLock as () => Promise<void> | void).call(el);
      } catch {
        this.setStatus('unsupported');
        return this.status;
      }
      this.wantRaw = false;
    }
    return this.status;
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onLockChange = () => {
    if (this.el && document.pointerLockElement === this.el) {
      this.attach();
      this.setStatus(this.wantRaw ? 'raw' : 'os-accel');
    } else {
      this.detach();
      this.setStatus('unlocked');
    }
  };

  private attach() {
    const el = this.el!;
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
    // pointermove 会被浏览器合并，取回被合并的事件以保留高回报率的细节
    const events =
      !this.usingRawUpdate && typeof e.getCoalescedEvents === 'function'
        ? e.getCoalescedEvents()
        : [];
    const list = events.length ? events : [e];
    for (const ev of list) {
      // 事件的 timeStamp 与 performance.now() 同一时间基准
      const sample: MoveSample = { t: ev.timeStamp || performance.now(), dx: ev.movementX, dy: ev.movementY };
      for (const fn of this.listeners) fn(sample);
    }
  };

  private setStatus(s: RawStatus) {
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }
}

export const STATUS_LABEL: Record<RawStatus, string> = {
  unlocked: '未锁定鼠标',
  raw: '原始输入（已绕过系统加速）',
  'os-accel': '非原始输入：受系统指针设置影响',
  unsupported: '浏览器不支持鼠标锁定'
};
