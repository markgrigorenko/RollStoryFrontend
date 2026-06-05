<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string
    variant?: 'success' | 'error'
    durationMs?: number
  }>(),
  { variant: 'success', durationMs: 5000 }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  timer = setTimeout(() => emit('close'), props.durationMs)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div
    class="app-toast"
    :class="`app-toast--${variant}`"
    role="status"
    aria-live="polite"
  >
    <span class="app-toast__icon" aria-hidden="true">
      <svg
        v-if="variant === 'success'"
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </span>
    <p class="app-toast__message">{{ message }}</p>
    <button type="button" class="app-toast__close" aria-label="Закрыть" @click="emit('close')">
      ×
    </button>
  </div>
</template>

<style scoped>
.app-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  z-index: 2100;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(480px, calc(100vw - 32px));
  padding: 12px 14px 12px 16px;
  border-radius: 12px;
  background: rgba(33, 33, 33, 0.96);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  color: #fff;
  animation: app-toast-in 0.25s ease;
}

.app-toast--success {
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.app-toast--error {
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.app-toast__icon {
  flex-shrink: 0;
  display: flex;
  color: #4ade80;
}

.app-toast--error .app-toast__icon {
  color: #f87171;
}

.app-toast__message {
  margin: 0;
  flex: 1;
  font-size: 14px;
  line-height: 1.35;
}

.app-toast__close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.app-toast__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

@keyframes app-toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
