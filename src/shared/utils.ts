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

/** 安全解析 JSON 字符串，失败时返回空对象 */
export function safeJsonParse<T = Record<string, unknown>>(raw?: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
