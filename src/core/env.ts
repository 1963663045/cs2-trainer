// 运行环境检测（只用于给出提示，不影响功能）
export interface EnvInfo {
  touchOnly: boolean; // 没有精确指针（手机 / 平板）
  chromium: boolean; // Chrome / Edge 等 Chromium 内核，支持 unadjustedMovement
  pointerLock: boolean;
}

export function detectEnv(nav: Navigator = navigator, mm: (q: string) => boolean = (q) => matchMedia(q).matches): EnvInfo {
  const brands = (nav as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  const ua = nav.userAgent || '';
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) || (/Chrome\//.test(ua) && !/Firefox\//.test(ua));
  return {
    touchOnly: mm('(pointer: coarse)') && !mm('(any-pointer: fine)'),
    chromium,
    pointerLock: typeof document !== 'undefined' && 'requestPointerLock' in document.createElement('canvas')
  };
}
