import { describe, expect, it, vi } from 'vitest';
import { detectEnv } from './env';

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
