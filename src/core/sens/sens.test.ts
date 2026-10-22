import { describe, expect, it } from 'vitest';
import { cmPer360, convertSens, degToCm, edpi, horizontalFov, verticalFov } from './index';

describe('sens', () => {
  it('eDPI', () => expect(edpi(800, 1.25)).toBe(1000));
  it('cm/360: CS2 sens 1 @ 800 DPI ≈ 51.95 cm', () => {
    expect(cmPer360(800, 1, 0.022)).toBeCloseTo(51.95, 2);
  });
  it('CS2 -> Valorant 同 DPI 乘以 0.022/0.07', () => {
    expect(convertSens(1, 0.022, 0.07)).toBeCloseTo(0.3143, 4);
  });
  it('换 DPI 保持 cm/360', () => {
    const s = convertSens(2, 0.022, 0.022, 400, 800);
    expect(s).toBeCloseTo(1, 6);
    expect(cmPer360(400, 2, 0.022)).toBeCloseTo(cmPer360(800, s, 0.022), 6);
  });
  it('degToCm 示例 11.06° @ sens1/800DPI ≈ 1.596 cm', () => {
    expect(degToCm(11.06, 800, 1, 0.022)).toBeCloseTo(1.596, 3);
  });
  it('Hor+ FOV', () => {
    expect(horizontalFov(4 / 3)).toBeCloseTo(90, 6);
    expect(horizontalFov(16 / 9)).toBeCloseTo(106.26, 2);
    expect(verticalFov()).toBeCloseTo(73.74, 2);
  });
});
