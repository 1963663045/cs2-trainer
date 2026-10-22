// 灵敏度换算核心（纯函数，便于单元测试）
// yaw 值来源见 README「数据来源」：CS2/CS:GO/Apex 0.022、Valorant 0.07、Overwatch 2 0.0066。

export interface GameYaw {
  id: string;
  name: string;
  yaw: number; // 灵敏度为 1 时每个鼠标计数（count）转动的角度（度）
  note: string;
}

export const GAMES: GameYaw[] = [
  { id: 'cs2', name: 'CS2 / CS:GO', yaw: 0.022, note: 'm_yaw 默认 0.022' },
  { id: 'apex', name: 'Apex Legends（腰射）', yaw: 0.022, note: 'Source 系 0.022；开镜倍率另计' },
  { id: 'valorant', name: 'VALORANT', yaw: 0.07, note: '0.07' },
  { id: 'ow2', name: 'Overwatch 2', yaw: 0.0066, note: '0.0066' }
];

export const CM_PER_INCH = 2.54;

export const edpi = (dpi: number, sens: number) => dpi * sens;

/** 转一圈需要多少个鼠标计数 */
export const countsPer360 = (sens: number, yaw: number) => 360 / (sens * yaw);

/** cm/360 = 360 / (sens*yaw) / DPI * 2.54 */
export const cmPer360 = (dpi: number, sens: number, yaw: number) =>
  (countsPer360(sens, yaw) / dpi) * CM_PER_INCH;

/** 保持 cm/360 不变的跨游戏换算（同 DPI 或不同 DPI 都可） */
export function convertSens(
  sens: number,
  fromYaw: number,
  toYaw: number,
  fromDpi = 1,
  toDpi = fromDpi
): number {
  return (sens * fromYaw * fromDpi) / (toYaw * toDpi);
}

/** 视角角度 -> 鼠标移动厘米 */
export const degToCm = (deg: number, dpi: number, sens: number, yaw: number) =>
  (deg / (sens * yaw) / dpi) * CM_PER_INCH;

/** 鼠标计数 -> 视角角度 */
export const countsToDeg = (counts: number, sens: number, yaw: number) => counts * sens * yaw;

export type AspectMode = '16:9' | '4:3-stretched' | '4:3-blackbars' | '16:10';

/**
 * Hor+ 水平视野：以 4:3 下水平 90° 为基准。
 * hfov = 2*atan( tan(45°) * (aspect / (4/3)) )
 * 4:3 拉伸与 4:3 黑边在游戏内渲染都是 4:3（90°），拉伸只改变显示到屏幕上的横向比例。
 */
export function horizontalFov(renderAspect: number, baseFov4x3 = 90): number {
  const half = (baseFov4x3 / 2) * (Math.PI / 180);
  return (2 * Math.atan(Math.tan(half) * (renderAspect / (4 / 3))) * 180) / Math.PI;
}

export function renderAspectOf(mode: AspectMode): number {
  switch (mode) {
    case '16:9':
      return 16 / 9;
    case '16:10':
      return 16 / 10;
    default:
      return 4 / 3;
  }
}

/** 垂直视野（与宽高比无关的 Hor+：4:3 下 90° 水平对应的垂直视野） */
export function verticalFov(baseFov4x3 = 90): number {
  const half = (baseFov4x3 / 2) * (Math.PI / 180);
  return (2 * Math.atan(Math.tan(half) * (3 / 4)) * 180) / Math.PI;
}
