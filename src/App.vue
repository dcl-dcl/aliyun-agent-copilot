<script setup lang="ts">
import { ref, useShadowRoot, computed } from 'vue';
import { ConfigProvider, App } from 'ant-design-vue';
import { StyleProvider, XProvider } from 'ant-design-x-vue';
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';
import Chat, { type Props as ChatProps } from './views/Chat.vue';
import { agentAvatarUrl, safeJsonParse } from './shared/utils';

interface Props extends Omit<ChatProps, 'bizParams'> {
  /** 额外业务参数，会随请求体一起发送 (JSON 字符串) */
  bizParams?: string;
  /** 主题色 */
  colorPrimary?: string;
}

const props = defineProps<Props>();

const shadowRoot = useShadowRoot()!;

const appConfig = computed<ThemeConfig>(() => ({
  token: {
    colorPrimary: props.colorPrimary ?? '#2DC8C8',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif',
  },
}));

/** 弹层挂载到 ShadowRoot */
const getPopupContainer = () => shadowRoot as unknown as HTMLElement;

const isOpen = ref(false);

/** 解析 bizParams JSON 字符串 */
const parsedBizParams = computed(() => safeJsonParse<Record<string, unknown>>(props.bizParams));

/** 将主题色暴露给 CSS 变量 */
const hostStyle = computed(() => ({
  '--er-primary-color': props.colorPrimary ?? '#2DC8C8',
}));
</script>

<template>
  <div :style="hostStyle">
    <StyleProvider :container="shadowRoot">
      <ConfigProvider :theme="appConfig" :get-popup-container="getPopupContainer">
        <App>
          <XProvider :get-popup-container="getPopupContainer">
            <!-- 悬浮球 -->
            <button v-show="!isOpen" class="er-data-chat-launcher" aria-label="打开对话" @click="isOpen = true">
              <img :src="botAvatar || agentAvatarUrl" alt="" class="er-data-chat-launcher__avatar" />
            </button>

            <!-- 聊天窗口：用 v-show 保留组件状态，关闭后会话消息不丢失 -->
            <Chat
              v-show="isOpen"
              :endpoint="endpoint"
              :bot-name="botName"
              :welcome-text="welcomeText"
              :bot-avatar="botAvatar"
              :user-avatar="userAvatar"
              :biz-params="parsedBizParams"
              @close="isOpen = false"
            />
          </XProvider>
        </App>
      </ConfigProvider>
    </StyleProvider>
  </div>
</template>

<style>
@import 'ant-design-vue/dist/reset.css';

* {
  box-sizing: border-box;
}

:host {
  display: contents;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

button,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

/* ===== 悬浮球 ===== */
.er-data-chat-launcher {
  position: fixed;
  right: 32px;
  bottom: 32px;
  z-index: 9998;
  padding: 0;
  background: none;
  border: none;
  box-shadow: none;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.er-data-chat-launcher:hover {
  transform: scale(1.08);
}

.er-data-chat-launcher__avatar {
  display: block;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
</style>