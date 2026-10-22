import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { detectEnv } from '../core/env';
import { useSettings } from '../store/settings';

/** 全局提示：触屏设备、非 Chromium 浏览器、首次使用 */
export function Notices() {
  const env = useMemo(() => detectEnv(), []);
  const configured = useSettings((s) => s.configured);
  const set = useSettings((s) => s.set);
  const [hideBrowser, setHideBrowser] = useState(() => sessionStorage.getItem('hide-browser-notice') === '1');
  const loc = useLocation();
  return (
    <>
      {env.touchOnly && (
        <div className="banner warn" role="alert">
          检测到触屏设备：本站的训练需要鼠标与鼠标锁定（Pointer Lock），手机 / 平板无法使用。可以浏览说明与计算器。
        </div>
      )}
      {!env.touchOnly && !env.pointerLock && (
        <div className="banner warn" role="alert">当前浏览器不支持鼠标锁定（Pointer Lock），训练功能不可用，请使用最新版 Chrome / Edge。</div>
      )}
      {!env.touchOnly && env.pointerLock && !env.chromium && !hideBrowser && (
        <div className="banner warn" role="status">
          当前浏览器（如 Firefox / Safari）可能不支持原始鼠标输入（unadjustedMovement），手感会受系统指针加速影响。建议使用最新版 Chrome / Edge。
          <button
            type="button"
            className="link"
            onClick={() => {
              sessionStorage.setItem('hide-browser-notice', '1');
              setHideBrowser(true);
            }}
          >
            知道了
          </button>
        </div>
      )}
      {!configured && loc.pathname !== '/' && (
        <div className="banner info" role="status" data-testid="onboarding">
          首次使用：请先到 <Link to="/">设置</Link> 填写鼠标 DPI 与 CS2 灵敏度，角度与厘米换算才会准确。
          <button type="button" className="link" onClick={() => set({ configured: true })}>
            已填写，不再提示
          </button>
        </div>
      )}
      {!configured && loc.pathname === '/' && (
        <div className="banner info" role="status" data-testid="onboarding">
          欢迎！先填写下面的 DPI 和 CS2 灵敏度（与游戏内一致），然后去「灵敏度」或「压枪训练」页。
        </div>
      )}
    </>
  );
}
