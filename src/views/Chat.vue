<script lang="ts">
import { agentAvatarUrl, userAvatarUrl } from '../shared/utils';
import type { Thought } from '../shared/sse';

export interface Props {
  /** 后端聊天接口地址，默认 /api/chat */
  endpoint?: string;
  /** 机器人名称 */
  botName?: string;
  /** 居中欢迎介绍语 */
  welcomeText?: string;
  /** 机器人头像，支持图片 URL 或 SVG data URI */
  botAvatar?: string;
  /** 用户头像，支持图片 URL 或 SVG data URI */
  userAvatar?: string;
  /** 额外业务参数，会随请求体一起发送 */
  bizParams?: Record<string, unknown>;
}

/**
 * withDefaults 的默认值在 <script setup> 中不能引用局部变量（会被提升到 setup 外求值），
 * 因此把带变量引用的默认值放到普通 <script> 中，通过模块作用域常量引用。
 */
export const defaultProps = {
  endpoint: '/api/chat',
  botName: 'ER数据助手',
  welcomeText: '你好，我是ER数据智能助手\n请将您要分析的数据或问题告诉我',
  botAvatar: agentAvatarUrl,
  userAvatar: userAvatarUrl,
  bizParams: () => ({}),
};


</script>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, triggerRef, useShadowRoot } from 'vue';
import { Alert, Switch, Tooltip } from 'ant-design-vue';
import { BubbleList, type BubbleListProps, Sender } from 'ant-design-x-vue';
import {
  CloseOutlined,
  CompressOutlined,
  ExpandOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import MarkdownIt from 'markdown-it';
import { renderAssistantMessage, renderCopyFooter, renderThoughts } from '../composables/useMessageRender';
import { useCopyMessage } from '../composables/useCopyMessage';
import { debounce } from '../shared/utils';
import {
  mergeThoughts,
  normalizePayload,
  parseSseChunk,
  type StreamPayload,
} from '../shared/sse';

type ChatRole = 'ai' | 'user';

type Message = {
  key: string;
  role: ChatRole;
  content: string;
  thoughts?: Thought[];
  loading?: boolean;
  error?: boolean;
};

const props = withDefaults(defineProps<Props>(), defaultProps);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

const shadowRoot = useShadowRoot()!;
/** Tooltip 弹层挂载到 ShadowRoot */
const getPopupContainer = () => shadowRoot as unknown as HTMLElement;

const expanded = ref(true);
const hasChat = ref(false);
const messages = shallowRef<Message[]>([]);
const prompt = ref('');
const inputResetKey = ref(0);
const sessionId = ref<string>();
const isStreaming = ref(false);
const isSending = ref(false);
const showThoughts = ref(true);
const senderError = ref<string | null>(null);
const abortController = ref<AbortController>();
const listRef = ref<InstanceType<typeof BubbleList>>();
const { copiedMessageKey, copyMessage } = useCopyMessage();

const hasMessages = computed(() => messages.value.length > 0);

/** 流结束后等 typing 动画播完再解锁输入 */
const sendingDone = debounce(() => {
  if (!isStreaming.value) isSending.value = false;
}, 200);

/** 批量刷新 UI（triggerRef + 滚动），200ms 内多次调用合并为一次 */
const repaint = () => {
  triggerRef(messages);
  nextTick(() => {
    if (!hasMessages.value) return;
    listRef.value?.scrollTo({ key: messages.value[messages.value.length - 1].key, block: 'nearest' });
  });
};
const debouncedRepaint = debounce(repaint, 200);

/** 只有最后一条 AI 消息在流式过程中才显示 typing 动画 */
function showTypingEffect(msg: Message) {
  return (
    isSending.value &&
    msg.role === 'ai' &&
    messages.value.indexOf(msg) === messages.value.length - 1
  );
}

/** 为每个消息索引缓存 role 配置，避免每次重新创建闭包触发 BubbleList 不必要的重渲染 */
const messageRenderCache = new Map<number, Record<string, unknown>>();

const roles: BubbleListProps['roles'] = (bubbleData, index) => {
  if (bubbleData.role === 'user') {
    return {
      placement: 'end' as const,
      avatar: { src: props.userAvatar, style: { borderRadius: '10px' } },
      variant: 'filled' as const,
      styles: {
        content: {
          maxWidth: '88%',
          background: 'linear-gradient(135deg, #2DC8C8, #26b0b0)',
          color: '#fff',
        },
      },
    };
  }

  if (!messageRenderCache.has(index)) {
    messageRenderCache.set(index, {
      placement: 'start' as const,
      avatar: { src: props.botAvatar, style: { borderRadius: '10px', flexShrink: '0', alignSelf: 'flex-start' } },
      variant: 'shadow' as const,
      styles: { content: { maxWidth: '88%' } },
      onTypingComplete: sendingDone,
      messageRender: (content: unknown) => renderAssistantMessage(content, md),
      header: () => {
        const msg = bubbleItems.value[index];
        return renderThoughts(msg?.thoughts, msg?.loading);
      },
      footer: (_content: unknown) => {
        const msg = bubbleItems.value[index];
        const message = msg ? { key: msg.key, content: msg.content } : undefined;
        const isCopied = copiedMessageKey.value === msg?.key;
        return renderCopyFooter(message, isCopied, copyMessage, getPopupContainer);
      },
    });
  }
  return messageRenderCache.get(index)!;
};

const bubbleItems = computed(() =>
  messages.value.map((message) => ({
    ...message,
    typing: showTypingEffect(message) ? { step: 4, interval: 24 } : undefined,
  })),
);

/** 应用一个 payload 到助手消息上（累加文本、合并 thoughts、更新 sessionId） */
function applyPayload(msg: Message, raw: StreamPayload) {
  const payload = normalizePayload(raw);
  msg.content += payload.text;
  msg.thoughts = mergeThoughts(msg.thoughts || [], payload.thoughts || []);
  sessionId.value = payload.sessionId || sessionId.value;
  return payload;
}

async function sendMessage(message?: string) {
  const content = (message ?? prompt.value).trim();
  if (!content || isSending.value) return;
  hasChat.value = true;
  senderError.value = null;

  const userMessage: Message = {
    key: crypto.randomUUID(),
    role: 'user',
    content,
  };
  const assistantMessage: Message = {
    key: crypto.randomUUID(),
    role: 'ai',
    content: '',
    thoughts: [],
    loading: true,
  };

  messages.value.push(userMessage, assistantMessage);
  triggerRef(messages);
  prompt.value = '';
  inputResetKey.value += 1;
  isStreaming.value = true;
  isSending.value = true;
  abortController.value = new AbortController();
  repaint();

  try {
    const response = await fetch(props.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: content,
          session_id: sessionId.value,
        },
        biz_params: props.bizParams,
        parameters: {
          incremental_output: true,
          has_thoughts: showThoughts.value,
        },
      }),
      signal: abortController.value.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`请求失败：${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = parseSseChunk(buffer, (raw) => {
        const payload = applyPayload(assistantMessage, raw);
        if (payload.finishReason !== undefined) {
          assistantMessage.loading = payload.finishReason === 'null' || payload.finishReason === null;
        }
      });
      debouncedRepaint();
    }

    if (buffer.trim()) {
      parseSseChunk(`${buffer}\n\n`, (raw) => {
        applyPayload(assistantMessage, raw);
      });
    }

    assistantMessage.loading = false;
    triggerRef(messages);
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '本次返回没有文本内容，请换个问题再试。';
      triggerRef(messages);
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      assistantMessage.content = assistantMessage.content || '已停止本次回复。';
    } else {
      assistantMessage.error = true;
      assistantMessage.content = `接口调用失败：${(error as Error).message}`;
      senderError.value = (error as Error).message;
    }
    assistantMessage.loading = false;
    triggerRef(messages);
  } finally {
    isStreaming.value = false;
    abortController.value = undefined;
    sendingDone();
    repaint();
  }
}

function stopStreaming() {
  abortController.value?.abort();
}

function clearChat() {
  if (isStreaming.value) stopStreaming();
  sessionId.value = undefined;
  messages.value = [];
  messageRenderCache.clear();
  triggerRef(messages);
  prompt.value = '';
  inputResetKey.value += 1;
  hasChat.value = false;
  isSending.value = false;
  isStreaming.value = false;
  senderError.value = null;
}
</script>

<template>
  <section :class="['er-data-chat-window', { 'er-data-chat-window--expanded': expanded }]">
    <header class="er-data-chat-header">
      <img :src="botAvatar" alt="" class="er-data-chat-header__avatar" />
      <div class="er-data-chat-header__info">
        <span class="er-data-chat-header__title">{{ botName }}</span>
      </div>
      <div class="er-data-chat-header__actions">
        <Tooltip title="新对话" placement="bottom" :overlay-style="{ zIndex: 10001 }" :get-popup-container="getPopupContainer">
          <button class="er-data-chat-header__btn" aria-label="新对话" @click="clearChat">
            <PlusOutlined />
          </button>
        </Tooltip>
        <Tooltip :title="expanded ? '缩小' : '放大'" placement="bottom" :overlay-style="{ zIndex: 10001 }" :get-popup-container="getPopupContainer">
          <button
            class="er-data-chat-header__btn"
            :aria-label="expanded ? '缩小' : '放大'"
            @click="expanded = !expanded"
          >
            <CompressOutlined v-if="expanded" />
            <ExpandOutlined v-else />
          </button>
        </Tooltip>
        <Tooltip title="关闭" placement="bottom" :overlay-style="{ zIndex: 10001 }" :get-popup-container="getPopupContainer">
          <button class="er-data-chat-header__btn" aria-label="关闭对话" @click="emit('close')">
            <CloseOutlined />
          </button>
        </Tooltip>
      </div>
    </header>

    <div class="er-data-chat-body">
      <div v-if="!hasChat" class="er-data-chat-welcome">
        <img :src="botAvatar" alt="" class="er-data-chat-welcome__avatar" />
        <p class="er-data-chat-welcome__text">{{ welcomeText }}</p>
      </div>

      <div class="er-data-chat-list-wrap">
        <BubbleList ref="listRef" :items="bubbleItems" :roles="roles" class="bubble-list" />
      </div>

     <footer class="er-data-chat-composer">
       <Sender
         :key="inputResetKey"
         v-model:value="prompt"
         root-class-name="er-data-chat-sender"
         :auto-size="{ minRows: 1, maxRows: 3 }"
         :loading="isSending"
         placeholder="请输入您的问题 Enter + Shift回车"
         submit-type="enter"
         :on-submit="sendMessage"
         :on-cancel="stopStreaming"
         :actions="false"
       >
         <template #header>
           <Sender.Header v-if="senderError" :open="true" :styles="{ content: { padding: 0 } }">
             <Alert type="error" banner style="padding: 10px 16px" :message="senderError" />
           </Sender.Header>
         </template>
         <template #footer="{ info }">
           <div class="er-data-chat-sender-footer">
             <span class="er-data-chat-sender-footer__think">
               思考过程
               <Switch v-model:checked="showThoughts" size="small" />
             </span>
             <component :is="isSending ? info.components.LoadingButton : info.components.SendButton" />
           </div>
         </template>
       </Sender>
     </footer>
    </div>
  </section>
</template>

<style src="./chat.css"></style>
