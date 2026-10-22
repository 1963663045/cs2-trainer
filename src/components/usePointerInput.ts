import { useEffect, useRef } from 'react';
import { PointerInput } from '../core/input/pointerInput';
import { useRuntime } from '../store/settings';

/**
 * 每个页面持有一个 PointerInput 实例，并把原始输入状态同步到全局指示器。
 * 实例在 effect 中创建（兼容 React StrictMode 的二次挂载）；调用方必须在本 hook 之后声明自己的 effect。
 */
export function usePointerInput() {
  const ref = useRef<PointerInput | null>(null);
  const setRaw = useRuntime((s) => s.setRaw);
  useEffect(() => {
    const input = (ref.current ??= new PointerInput());
    // 同一页面可能有多个实例（如校准 + PSA）：其他实例拿到锁时，本实例的 'unlocked' 不覆盖全局状态
    const off = input.onStatus((st) => {
      if (st !== 'unlocked' || !document.pointerLockElement) setRaw(st);
    });
    return () => {
      off();
      input.unlock();
      input.dispose();
      setRaw('unlocked');
      ref.current = null;
    };
  }, [setRaw]);
  return ref;
}
