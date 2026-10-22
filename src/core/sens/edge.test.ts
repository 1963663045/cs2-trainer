import { describe, expect, it } from 'vitest';
import { cmPer360, convertSens, countsPer360, countsToDeg, degToCm, edpi, fmt, horizontalFov, isPos, LIMITS, renderAspectOf, stretchFactor, validateNumber, verticalFov } from './index';

const BAD = [0, -1, NaN, Infinity, -Infinity];

describe('灵敏度函数：非法输入返回 NaN', () => {
  it.each(BAD)('sens = %s', (b) => {
    expect(edpi(800, b)).toBeNaN();
    expect(cmPer360(800, b, 0.022)).toBeNaN();
    expect(countsPer360(b, 0.022)).toBeNaN();
    expect(convertSens(b, 0.022, 0.07)).toBeNaN();
    expect(degToCm(10, 800, b, 0.022)).toBeNaN();
    expect(countsToDeg(100, b, 0.022)).toBeNaN();
  });
  it.each(BAD)('dpi / yaw = %s', (b) => {
    expect(edpi(b, 1)).toBeNaN();
    expect(cmPer360(b, 1, 0.022)).toBeNaN();
    expect(cmPer360(800, 1, b)).toBeNaN();
    expect(convertSens(1, 0.022, 0.07, b, 800)).toBeNaN();
    expect(convertSens(1, 0.022, 0.07, 800, b)).toBeNaN();
  });
  it('fmt 把 NaN / Infinity 显示为 —', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
    expect(fmt(1.005, 1)).toBe('1.0');
    expect(isPos('1')).toBe(false);
  });
});

describe('DPI 极值', () => {
  it('1 DPI 与 100000 DPI 仍为有限值且互为比例', () => {
    const lo = cmPer360(1, 1, 0.022);
    const hi = cmPer360(100000, 1, 0.022);
    expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
    expect(lo / hi).toBeCloseTo(100000, 6);
    expect(cmPer360(400, 2, 0.022)).toBeCloseTo(cmPer360(800, 1, 0.022), 9); // 相同 eDPI 相同 cm/360
  });
  it('跨 DPI 换算保持 cm/360', () => {
    const v = convertSens(1.2, 0.022, 0.07, 800, 1600);
    expect(cmPer360(1600, v, 0.07)).toBeCloseTo(cmPer360(800, 1.2, 0.022), 9);
  });
  it('0 计数 = 0 度；负计数 = 反方向', () => {
    expect(countsToDeg(0, 1, 0.022)).toBe(0);
    expect(countsToDeg(-100, 1, 0.022)).toBeCloseTo(-2.2, 9);
  });
});

describe('视野与比例', () => {
  it('各比例 Hor+ 水平视野；垂直视野不随比例变化', () => {
    expect(horizontalFov(renderAspectOf('4:3-stretched'))).toBeCloseTo(90, 9);
    expect(horizontalFov(renderAspectOf('4:3-blackbars'))).toBeCloseTo(90, 9);
    expect(horizontalFov(renderAspectOf('16:10'))).toBeCloseTo(100.389, 3);
    expect(horizontalFov(renderAspectOf('16:9'))).toBeCloseTo(106.26, 2);
    expect(verticalFov()).toBeCloseTo(73.74, 2);
  });
  it('只有 4:3 拉伸有横向倍数', () => {
    expect(stretchFactor('4:3-stretched', 16 / 9)).toBeCloseTo(4 / 3, 9);
    expect(stretchFactor('4:3-stretched', 16 / 10)).toBeCloseTo(1.2, 9);
    expect(stretchFactor('4:3-stretched', 4 / 3)).toBe(1);
    expect(stretchFactor('4:3-stretched', NaN)).toBe(1);
    expect(stretchFactor('4:3-blackbars', 16 / 9)).toBe(1);
    expect(stretchFactor('16:9', 16 / 9)).toBe(1);
  });
});

describe('设置校验', () => {
  it('范围与类型', () => {
    expect(validateNumber('sens', 1)).toBeNull();
    expect(validateNumber('sens', 0)).not.toBeNull();
    expect(validateNumber('sens', -2)).not.toBeNull();
    expect(validateNumber('sens', NaN)).toBe('请输入数字');
    expect(validateNumber('dpi', '800')).toBe('请输入数字');
    expect(validateNumber('dpi', LIMITS.dpi[1])).toBeNull();
    expect(validateNumber('dpi', LIMITS.dpi[1] + 1)).not.toBeNull();
    expect(validateNumber('toleranceDeg', 0.05)).not.toBeNull();
  });
});
