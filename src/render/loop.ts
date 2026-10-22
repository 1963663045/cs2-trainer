// 按需运行的 requestAnimationFrame 循环：只有在需要时（鼠标锁定、开火中、动画播放中）才持续绘制，
// 空闲时只在状态变化后绘制一帧，避免后台空转。
export class RafLoop {
  private raf = 0;
  private stopped = false;
  frames = 0;
  /** draw 返回 true 表示下一帧继续 */
  constructor(private draw: (now: number) => boolean) {}

  kick = () => {
    if (this.stopped || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    this.raf = 0;
    if (this.stopped) return;
    this.frames++;
    if (this.draw(now)) this.raf = requestAnimationFrame(this.tick);
  };

  get running() {
    return this.raf !== 0;
  }

  dispose() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
