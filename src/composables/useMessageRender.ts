import { h } from 'vue';
import { Tooltip } from 'ant-design-vue';
import { ThoughtChain, type ThoughtChainItem } from 'ant-design-x-vue';
import {
  BulbOutlined,
  CheckOutlined,
  CopyOutlined,
  LoadingOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue';
import MarkdownIt from 'markdown-it';
import type { Thought } from '../shared/sse';

type CopyFn = (message?: { key: string; content: string; [key: string]: unknown }) => void;
type GetPopupContainer = () => HTMLElement;

export function renderAssistantMessage(content: unknown, md: InstanceType<typeof MarkdownIt>) {
  const html = md.render(String(content || ''));
  return h('div', { class: 'assistant-message' }, [
    h('div', { class: 'markdown-body', innerHTML: html }),
  ]);
}

export function renderThoughts(thoughts?: Thought[], streaming?: boolean) {
  const allThoughts = thoughts || [];
  if (!allThoughts.length) return null;

  const items: ThoughtChainItem[] = allThoughts.map((item, index) => {
    const isLast = index === allThoughts.length - 1;
    const status: ThoughtChainItem['status'] = streaming && isLast ? 'pending' : 'success';
    const title = item.action_name || item.action_type || item.action || '思考';

    let contentNode: ReturnType<typeof h> | undefined;

    if (item.action_name === 'activate_skill') {
      // 只显示 arguments 里的 name 字段
      try {
        const args = JSON.parse(item.action_input_stream || '{}');
        const skillName = args.name || '';
        if (skillName) {
          contentNode = h('span', { class: 'thought-skill-name' }, skillName);
        }
      } catch {
        // 解析失败则不显示内容
      }
    } else {
      const text = [item.thought, item.action_input_stream]
        .filter(Boolean)
        .join('\n');
      if (text.trim()) {
        contentNode = h('pre', { class: 'thought-plain-text' }, text);
      }
    }

    return {
      key: String(index),
      title,
      status,
      icon: status === 'pending' ? h(LoadingOutlined) : (title === '思考过程' ? h(BulbOutlined) : h(ToolOutlined)),
      ...(contentNode ? { content: contentNode } : {}),
    };
  });

  return h(
    'div',
    { class: 'thought-chain-wrap' },
    h(ThoughtChain, { items, size: 'small', collapsible: true }),
  );
}

export function renderCopyFooter(
  message: { key: string; content: string } | undefined,
  isCopied: boolean,
  onCopy: CopyFn,
  getPopupContainer: GetPopupContainer,
) {
  return h(
    Tooltip,
    {
      title: isCopied ? '已复制' : '复制',
      placement: 'top',
      overlayStyle: { zIndex: 10001 },
      getPopupContainer,
    },
    {
      default: () =>
        h(
          'button',
          {
            type: 'button',
            class: ['assistant-message__copy-btn', { 'assistant-message__copy-btn--copied': isCopied }],
            'aria-label': isCopied ? '已复制' : '复制内容',
            onClick: () => onCopy(message),
          },
          [h(isCopied ? CheckOutlined : CopyOutlined)],
        ),
    },
  );
}
