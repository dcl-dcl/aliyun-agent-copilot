/**
 * 共享工具函数与常量
 * 从 App.vue / Chat.vue 中提取，消除重复代码
 */
import agentAvatarUrl from '../assets/agent-avatar.svg';
import userAvatarUrl from '../assets/user-avatar.svg';

/** 默认机器人头像 */
export { agentAvatarUrl };
/** 默认用户头像 */
export { userAvatarUrl };

/** 轻量 debounce，避免高频 SSE chunk 逐帧触发渲染 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** 生成消息 key；兼容 HTTP 非安全上下文 */
export function createMessageKey() {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.getRandomValues === 'function') {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 安全解析 JSON 字符串，失败时返回空对象 */
export function safeJsonParse<T = Record<string, unknown>>(raw?: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
