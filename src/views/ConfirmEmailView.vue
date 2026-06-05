<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoLoginUrl from '@/assets/brand/logo-login.svg'
import { HttpError, verifyEmail } from '@/shared/api'
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from '@/shared/lib/pendingEmailVerification'
import { verifyEmailErrorMessage, isVerifyEmailAlreadyUsedReason } from '@/shared/lib/verifyEmailErrors'
import AuthBrandLink from '@/shared/ui/AuthBrandLink.vue'

type Phase = 'loading' | 'awaiting' | 'error'

const router = useRouter()
const route = useRoute()

const phase = ref<Phase>('loading')
const pendingEmail = ref<string | null>(null)
const storedVerificationToken = ref<string | null>(null)
const submitError = ref<string | null>(null)
const resendCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const canRetry = computed(
  () => phase.value === 'error' && Boolean(storedVerificationToken.value)
)

function startCountdown() {
  resendCountdown.value = 59
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    resendCountdown.value -= 1
    if (resendCountdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function submitVerification(token: string) {
  phase.value = 'loading'
  submitError.value = null
  try {
    const result = await verifyEmail(token)
    if (result.status === 'error') {
      if (isVerifyEmailAlreadyUsedReason(result.reason)) {
        clearPendingEmailVerification()
        await router.push({ name: 'login', query: { verified: '1' } })
        return
      }
      submitError.value = verifyEmailErrorMessage(result.reason)
      phase.value = 'error'
      return
    }
    clearPendingEmailVerification()
    await router.push({ name: 'login', query: { verified: '1' } })
  } catch (err) {
    if (err instanceof HttpError) {
      submitError.value = err.message || 'Не удалось подтвердить email. Попробуйте позже.'
    } else {
      submitError.value = 'Не удалось подтвердить email. Попробуйте позже.'
    }
    phase.value = 'error'
  }
}

async function handleRetry() {
  const token = storedVerificationToken.value
  if (!token) return
  await submitVerification(token)
}

function handleResend() {
  if (resendCountdown.value > 0) return
  // Повторная отправка появится после подключения SMTP (issue #29).
  startCountdown()
}

function handleBackToRegister() {
  clearPendingEmailVerification()
  router.push({ name: 'register' })
}

onMounted(() => {
  const pending = getPendingEmailVerification()
  if (!pending) {
    router.replace({ name: 'register' })
    return
  }

  pendingEmail.value = pending.email
  storedVerificationToken.value = pending.verificationToken ?? null

  const reasonFromQuery = route.query.reason
  if (typeof reasonFromQuery === 'string' && reasonFromQuery.trim().length > 0) {
    if (isVerifyEmailAlreadyUsedReason(reasonFromQuery)) {
      clearPendingEmailVerification()
      void router.replace({ name: 'login', query: { verified: '1' } })
      return
    }
    submitError.value = verifyEmailErrorMessage(reasonFromQuery.trim())
    phase.value = 'error'
    return
  }

  const tokenFromQuery = route.query.token
  if (typeof tokenFromQuery === 'string' && tokenFromQuery.trim().length > 0) {
    void submitVerification(tokenFromQuery.trim())
    return
  }

  if (pending.verificationToken) {
    void submitVerification(pending.verificationToken)
    return
  }

  phase.value = 'awaiting'
  startCountdown()
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
        <template v-if="phase === 'loading'">
          <h1 class="auth-page__title">Подтверждение email</h1>
          <p class="auth-page__subtitle">Проверяем ссылку…</p>
          <div class="auth-page__loading" aria-busy="true">
            <span class="auth-page__spinner" aria-hidden="true" />
          </div>
        </template>

        <template v-else-if="phase === 'awaiting'">
          <h1 class="auth-page__title">Проверьте почту</h1>
          <p v-if="pendingEmail" class="auth-page__subtitle">
            Мы отправили письмо с ссылкой для подтверждения на {{ pendingEmail }}.
            Перейдите по ссылке в письме, чтобы активировать аккаунт.
          </p>
          <div class="auth-page__fields">
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
              title="Повторная отправка появится после подключения почтового сервера"
              @click="handleResend"
            >
              Отправить письмо ещё раз
              <template v-if="resendCountdown > 0"> ({{ resendCountdown }})</template>
            </button>
          </div>
        </template>

        <template v-else>
          <h1 class="auth-page__title">Не удалось подтвердить</h1>
          <p v-if="pendingEmail" class="auth-page__subtitle">
            Email: {{ pendingEmail }}
          </p>
          <p v-if="submitError" class="auth-page__error" role="alert">
            {{ submitError }}
          </p>
          <div class="auth-page__fields">
            <button
              v-if="canRetry"
              type="button"
              class="auth-page__btn auth-page__btn--primary"
              @click="handleRetry"
            >
              Попробовать снова
            </button>
            <button
              type="button"
              class="auth-page__btn auth-page__btn--secondary"
              @click="handleBackToRegister"
            >
              Зарегистрироваться заново
            </button>
          </div>
        </template>
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
