// 运行环境检测（只用于给出提示，不影响功能）
export interface EnvInfo {
  touchOnly: boolean; // 没有精确指针（手机 / 平板）
  chromium: boolean; // Chrome / Edge 等 Chromium 内核，支持 unadjustedMovement
  pointerLock: boolean;
  os: OsKind;
}

export type OsKind = 'windows' | 'mac' | 'linux' | 'chromeos' | 'android' | 'ios' | 'other';

export function detectOs(nav: Navigator = navigator): OsKind {
  const p = ((nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || nav.platform || '') + ' ' + (nav.userAgent || '');
  if (/Android/i.test(p)) return 'android';
  if (/iPhone|iPad|iOS/i.test(p)) return 'ios';
  if (/CrOS|Chrome OS|ChromeOS/i.test(p)) return 'chromeos';
  if (/Win/i.test(p)) return 'windows';
  if (/Mac/i.test(p)) return 'mac';
  if (/Linux|X11/i.test(p)) return 'linux';
  return 'other';
}

export function detectEnv(nav: Navigator = navigator, mm: (q: string) => boolean = (q) => matchMedia(q).matches): EnvInfo {
  const brands = (nav as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  const ua = nav.userAgent || '';
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) || (/Chrome\//.test(ua) && !/Firefox\//.test(ua));
  return {
    touchOnly: mm('(pointer: coarse)') && !mm('(any-pointer: fine)'),
    chromium,
    pointerLock: typeof document !== 'undefined' && 'requestPointerLock' in document.createElement('canvas'),
    os: detectOs(nav)
  };
}

/**
 * 非原始输入时的提示文字（按平台）。依据：web.dev「Disable mouse acceleration」——Chrome 88+ 在
 * Windows、macOS（10.15.1+）、ChromeOS 上支持 unadjustedMovement，Linux 尚未实现；不支持时
 * requestPointerLock 会以 NotSupportedError 拒绝，本站随即降级为普通锁定。
 */
export function rawInputHint(os: OsKind, status: 'os-accel' | 'unsupported'): string {
  if (status === 'unsupported') return '当前浏览器不支持鼠标锁定，训练功能无法使用。请使用最新版 Chrome / Edge。';
  switch (os) {
    case 'linux':
      return 'Linux 版 Chrome 目前不支持原始输入选项（unadjustedMovement 仅在 Windows / macOS / ChromeOS 上实现），已改用普通鼠标锁定。若系统鼠标加速已关闭（GNOME / KDE 中设为“平坦 / flat”），手感与原始输入基本一致。';
    case 'windows':
      return '未能启用原始输入，移动会经过 Windows 指针设置。建议使用最新版 Chrome / Edge；或关闭“提高指针精确度”，指针速度保持 6/11。';
    case 'mac':
      return '未能启用原始输入，移动会经过 macOS 指针加速。建议使用最新版 Chrome / Edge（macOS 10.15.1 及以上支持原始输入）。';
    default:
      return '未能启用原始输入，移动可能经过系统指针加速。建议在 Windows / macOS 上使用最新版 Chrome / Edge。';
  }
}
