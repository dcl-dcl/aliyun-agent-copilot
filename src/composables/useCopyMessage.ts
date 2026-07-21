import { ref } from 'vue';

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function useCopyMessage() {
  const copiedMessageKey = ref<string | null>(null);
  let copyResetTimer: number | undefined;

  async function copyMessage(message?: { key: string; content: string }) {
    const text = String(message?.content || '').trim();
    const key = message?.key;
    if (!text || !key) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopyText(text);
      }

      copiedMessageKey.value = key;
      if (copyResetTimer) window.clearTimeout(copyResetTimer);
      copyResetTimer = window.setTimeout(() => {
        if (copiedMessageKey.value === key) copiedMessageKey.value = null;
      }, 1500);
    } catch {
      fallbackCopyText(text);
      copiedMessageKey.value = key;
    }
  }

  return { copiedMessageKey, copyMessage };
}
