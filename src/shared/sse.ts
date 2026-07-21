/**
 * SSE 流式响应解析与类型定义
 * 从 Chat.vue 中提取，便于维护与复用
 */

/** 单条思考/工具调用过程 */
export type Thought = {
  thought?: string | null;
  response?: string | null;
  action_type?: string | null;
  action_name?: string | null;
  action?: string | null;
  observation?: string | null;
  action_input_stream?: string | null;
  arguments?: string | null;
};

/** SSE 流式返回的原始 payload */
export type StreamPayload = {
  output?: {
    text?: string;
    finish_reason?: string | null;
    session_id?: string;
    thoughts?: Thought[] | null;
  };
  text?: string;
  finish_reason?: string | null;
  session_id?: string;
  thoughts?: Thought[] | null;
};

/** 规范化后的 payload */
export type NormalizedPayload = {
  text: string;
  sessionId?: string;
  thoughts: Thought[];
  finishReason?: string | null;
};

/** 将原始 payload 扁平化为统一结构 */
export function normalizePayload(raw: StreamPayload): NormalizedPayload {
  const output = raw.output || raw;
  return {
    text: output.text || '',
    sessionId: output.session_id || raw.session_id,
    thoughts: output.thoughts || raw.thoughts || [],
    finishReason: output.finish_reason ?? raw.finish_reason,
  };
}

/** incremental_output 模式下 thought/response 等字段是增量片段，需要拼接而非替换 */
export function mergeThoughts(prev: Thought[], next: Thought[]): Thought[] {
  return next.map((nt, i) => {
    const pt = prev[i];
    // 没有前一条，或者 action_name 不同（新的 thought 条目），直接用新的
    if (!pt) return nt;
    const prevName = pt.action_name || pt.action_type || pt.action;
    const nextName = nt.action_name || nt.action_type || nt.action;
    if (prevName !== nextName) return nt;
    return {
      ...nt,
      thought: (pt.thought || '') + (nt.thought || ''),
      response: (pt.response || '') + (nt.response || ''),
      observation: (pt.observation || '') + (nt.observation || ''),
      action_input_stream: (pt.action_input_stream || '') + (nt.action_input_stream || ''),
      arguments: (pt.arguments || '') + (nt.arguments || ''),
    };
  });
}

/**
 * 解析 SSE 缓冲区，按 \n\n 分割事件，提取 data: 行并 JSON 解析。
 * @returns 剩余未完成的片段（最后一次 \n\n 之后的内容）
 */
export function parseSseChunk(
  buffer: string,
  onPayload: (payload: StreamPayload) => void,
): string {
  const events = buffer.split('\n\n');
  const rest = events.pop() || '';

  for (const event of events) {
    const data = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (!data || data === '[DONE]') continue;

    try {
      onPayload(JSON.parse(data));
    } catch (error) {
      console.warn('无法解析 SSE 数据:', data, error);
    }
  }

  return rest;
}
