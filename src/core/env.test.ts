import { describe, expect, it, vi } from 'vitest';
import { detectEnv, detectOs, rawInputHint } from './env';

vi.stubGlobal('document', { createElement: () => ({ requestPointerLock() {} }) });

const nav = (ua: string, brands?: string[]) => ({ userAgent: ua, userAgentData: brands ? { brands: brands.map((brand) => ({ brand })) } : undefined }) as unknown as Navigator;

describe('detectEnv', () => {
  it('识别 Chromium / Firefox / 触屏', () => {
    const fine = (q: string) => q.includes('fine');
    expect(detectEnv(nav('Mozilla/5.0 Chrome/140.0', ['Chromium', 'Google Chrome']), fine).chromium).toBe(true);
    expect(detectEnv(nav('Mozilla/5.0 Gecko/20100101 Firefox/140.0'), fine).chromium).toBe(false);
    expect(detectEnv(nav('Mozilla/5.0 Version/18 Safari/605.1.15'), fine).chromium).toBe(false);
    const coarse = (q: string) => q.includes('coarse');
    expect(detectEnv(nav('iPhone Safari'), coarse).touchOnly).toBe(true);
    expect(detectEnv(nav('x'), fine).touchOnly).toBe(false);
  });
});

describe('平台与提示文字', () => {
  it('识别系统', () => {
    expect(detectOs(nav('Mozilla/5.0 (X11; Linux x86_64) Chrome/140'))).toBe('linux');
    expect(detectOs(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'))).toBe('windows');
    expect(detectOs(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'))).toBe('mac');
    expect(detectOs(nav('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)'))).toBe('chromeos');
    expect(detectOs(nav('Mozilla/5.0 (Linux; Android 14) Chrome/140'))).toBe('android');
  });
  it('Linux 提示说明这是平台限制而非故障', () => {
    expect(rawInputHint('linux', 'os-accel')).toMatch(/Linux 版 Chrome 目前不支持/);
    expect(rawInputHint('linux', 'os-accel')).toMatch(/Windows \/ macOS \/ ChromeOS/);
    expect(rawInputHint('windows', 'os-accel')).toMatch(/提高指针精确度/);
    expect(rawInputHint('other', 'unsupported')).toMatch(/不支持鼠标锁定/);
  });
});
