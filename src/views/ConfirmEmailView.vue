<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import logoLoginUrl from '@/assets/brand/logo-login.svg'
import { HttpError, resendVerification } from '@/shared/api'
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from '@/shared/lib/pendingEmailVerification'
import AuthBrandLink from '@/shared/ui/AuthBrandLink.vue'

// Пост-регистрационный экран «проверьте почту». Сам токен из письма
// обрабатывает отдельная страница /register/verify (RegisterVerifyView).
// Здесь — только напоминание + повторная отправка письма через
// POST /auth/resend-verification (email+password как «лёгкая авторизация»;
// ответ всегда 204, чтобы нельзя было перечислять пользователей).

const router = useRouter()

const pendingEmail = ref<string | null>(null)
const resendPassword = ref('')
const resendOpen = ref(false)
const resendLoading = ref(false)
const resendInfo = ref<string | null>(null)
const resendError = ref<string | null>(null)
const resendCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const RESEND_COOLDOWN_SECONDS = 60

function startCountdown() {
  resendCountdown.value = RESEND_COOLDOWN_SECONDS
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    resendCountdown.value -= 1
    if (resendCountdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function handleToggleResend() {
  if (resendCountdown.value > 0) return
  resendError.value = null
  resendInfo.value = null
  resendOpen.value = !resendOpen.value
}

async function submitResend() {
  const email = pendingEmail.value
  if (!email) return
  if (resendCountdown.value > 0 || resendLoading.value) return
  if (resendPassword.value.length === 0) {
    resendError.value = 'Введите пароль от аккаунта.'
    return
  }

  resendLoading.value = true
  resendError.value = null
  resendInfo.value = null
  try {
    await resendVerification({ email, password: resendPassword.value, locale: 'ru' })
    // Бэк всегда 204, даже если пара email/пароль неверная — это специально,
    // чтобы нельзя было через ответ узнавать, есть ли такой аккаунт.
    resendInfo.value = 'Если данные верны, мы выслали новое письмо. Проверьте почту.'
    resendPassword.value = ''
    resendOpen.value = false
    startCountdown()
  } catch (err) {
    resendError.value =
      err instanceof HttpError
        ? err.message || 'Не удалось отправить письмо. Попробуйте позже.'
        : 'Не удалось отправить письмо. Попробуйте позже.'
  } finally {
    resendLoading.value = false
  }
}

function handleBackToRegister() {
  clearPendingEmailVerification()
  void router.push({ name: 'register' })
}

onMounted(() => {
  const pending = getPendingEmailVerification()
  if (!pending) {
    void router.replace({ name: 'register' })
    return
  }
  pendingEmail.value = pending.email
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__bg" aria-hidden="true">
      <img :src="logoLoginUrl" alt="" class="auth-page__bg-logo" />
    </div>

    <AuthBrandLink variant="auth" />

    <main class="auth-page__form-wrapper">
      <div class="auth-page__form">
        <h1 class="auth-page__title">Проверьте почту</h1>
        <p v-if="pendingEmail" class="auth-page__subtitle">
          Мы отправили письмо с ссылкой для подтверждения на {{ pendingEmail }}.
          Перейдите по ссылке в письме, чтобы активировать аккаунт.
        </p>

        <p v-if="resendInfo" class="auth-page__info" role="status">{{ resendInfo }}</p>

        <!-- Инлайн-форма повторной отправки. email уже знаем — нужен только пароль. -->
        <form
          v-if="resendOpen"
          class="auth-page__fields"
          @submit.prevent="submitResend"
        >
          <input
            v-model="resendPassword"
            type="password"
            autocomplete="current-password"
            placeholder="Пароль от аккаунта"
            class="auth-page__input"
            :disabled="resendLoading"
          />
          <p v-if="resendError" class="auth-page__error" role="alert">{{ resendError }}</p>
          <button
            type="submit"
            class="auth-page__btn auth-page__btn--primary"
            :disabled="resendLoading || resendPassword.length === 0"
          >
            {{ resendLoading ? 'Отправляем…' : 'Отправить письмо' }}
          </button>
          <button
            type="button"
            class="auth-page__btn auth-page__btn--secondary"
            :disabled="resendLoading"
            @click="resendOpen = false"
          >
            Отмена
          </button>
        </form>

        <div v-else class="auth-page__fields">
          <button
            type="button"
            class="auth-page__btn auth-page__btn--secondary"
            @click="handleBackToRegister"
          >
            Назад к регистрации
          </button>
          <button
            type="button"
            class="auth-page__resend"
            :disabled="resendCountdown > 0"
            @click="handleToggleResend"
          >
            Отправить письмо ещё раз
            <template v-if="resendCountdown > 0"> ({{ resendCountdown }})</template>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  --auth-bg: #1a1a1a;
  --auth-panel: #262626;
  --auth-border: rgba(255, 255, 255, 0.08);
  --auth-fg: #f5f5f5;
  --auth-fg-muted: #a3a3a3;
  --auth-brand: #e67e22;
  --auth-btn-primary-bg: #e5e5e5;
  --auth-btn-primary-fg: #262626;
  --auth-btn-secondary-bg: #404040;
  --auth-btn-secondary-fg: #f5f5f5;
  --auth-radius: 1rem;
  --auth-radius-lg: 1.5rem;
  --auth-space-s: 0.5rem;
  --auth-space-m: 1rem;
  --auth-space-l: 1.5rem;
  --auth-space-xl: 2rem;
  --auth-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);

  position: fixed;
  inset: 0;
  width: 100%;
  background: var(--auth-bg);
  color: var(--auth-fg);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.auth-page__error {
  margin: 0;
  font-size: 0.875rem;
  color: #dc2626;
  text-align: center;
}

.auth-page__info {
  margin: 0 0 var(--auth-space-m);
  padding: var(--auth-space-s) var(--auth-space-m);
  font-size: 0.875rem;
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
  border-radius: var(--auth-radius);
  text-align: center;
}

.auth-page__input {
  width: 100%;
  padding: var(--auth-space-m);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--auth-border);
  border-radius: var(--auth-radius);
  color: var(--auth-fg);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, background-color 0.2s;
}

.auth-page__input:focus {
  border-color: var(--auth-brand);
  background: rgba(255, 255, 255, 0.08);
}

.auth-page__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-page__subtitle {
  margin: calc(-1 * var(--auth-space-m)) 0 var(--auth-space-xl);
  font-size: 0.875rem;
  color: var(--auth-fg-muted);
  text-align: center;
  line-height: 1.4;
}

.auth-page__loading {
  display: flex;
  justify-content: center;
  padding: var(--auth-space-l) 0;
}

.auth-page__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.auth-page__bg-logo {
  position: absolute;
  top: 0;
  left: 0;
  width: 57%;
  height: calc(100% - 16px);
  object-fit: contain;
  object-position: left bottom;
}

.auth-page__form-wrapper {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--auth-space-xl);
}

.auth-page__form {
  width: 100%;
  max-width: 360px;
  background: var(--auth-panel);
  border-radius: var(--auth-radius-lg);
  box-shadow: var(--auth-shadow);
  padding: var(--auth-space-xl);
}

.auth-page__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--auth-fg);
  text-align: center;
  margin: 0 0 var(--auth-space-xl);
}

.auth-page__fields {
  display: flex;
  flex-direction: column;
  gap: var(--auth-space-m);
  align-items: stretch;
}

.auth-page__btn {
  width: 100%;
  padding: var(--auth-space-m) var(--auth-space-l);
  border: none;
  border-radius: var(--auth-radius);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.05s;
}

.auth-page__btn:active {
  transform: scale(0.99);
}

.auth-page__btn--primary {
  background: var(--auth-btn-primary-bg);
  color: var(--auth-btn-primary-fg);
}

.auth-page__btn--primary:hover:not(:disabled) {
  background: #d4d4d4;
}

.auth-page__btn--secondary {
  background: var(--auth-btn-secondary-bg);
  color: var(--auth-btn-secondary-fg);
}

.auth-page__btn--secondary:hover:not(:disabled) {
  background: #525252;
}

.auth-page__btn:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.auth-page__spinner {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: auth-page__spin 0.6s linear infinite;
  vertical-align: -0.25em;
}

@keyframes auth-page__spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-page__resend {
  background: none;
  border: none;
  padding: var(--auth-space-s) 0;
  color: var(--auth-fg-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s;
}

.auth-page__resend:hover:not(:disabled) {
  color: var(--auth-fg);
}

.auth-page__resend:disabled {
  cursor: default;
}
</style>
