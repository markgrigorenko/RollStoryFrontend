<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoLoginUrl from '@/assets/brand/logo-login.svg'
import { HttpError, verifyEmail } from '@/shared/api'
import { clearPendingEmailVerification } from '@/shared/lib/pendingEmailVerification'
import { isVerifyEmailAlreadyUsedReason, verifyEmailErrorMessage } from '@/shared/lib/verifyEmailErrors'
import AuthBrandLink from '@/shared/ui/AuthBrandLink.vue'

// Landing для ссылки из письма подтверждения email.
// Пользователь приходит сюда по ссылке вида /register/verify?token=<jwt>.
// Страница дёргает бэкенд GET /auth/verify-email?token=... и показывает
// результат. Сам бэк после погашения токена 302-редиректит на success/error URL
// — но fetch ловит редирект руками (см. `verifyEmail` в shared/api/authApi),
// поэтому пользователь остаётся здесь и видит понятный экран.

type Phase = 'loading' | 'success' | 'error'

const route = useRoute()
const router = useRouter()

const phase = ref<Phase>('loading')
const errorMessage = ref<string | null>(null)

const AUTO_REDIRECT_MS = 3000
let redirectTimer: ReturnType<typeof setTimeout> | null = null

function goToLogin() {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
  void router.push({ name: 'login', query: { verified: '1' } })
}

function handleBackToRegister() {
  clearPendingEmailVerification()
  void router.push({ name: 'register' })
}

async function runVerification(token: string) {
  try {
    const result = await verifyEmail(token)
    if (result.status === 'success') {
      clearPendingEmailVerification()
      phase.value = 'success'
      redirectTimer = setTimeout(goToLogin, AUTO_REDIRECT_MS)
      return
    }

    // status === 'error'. Отдельный случай: токен уже был использован —
    // фактически тоже успех (email подтверждён ранее), молча уводим на логин.
    if (isVerifyEmailAlreadyUsedReason(result.reason)) {
      clearPendingEmailVerification()
      phase.value = 'success'
      redirectTimer = setTimeout(goToLogin, AUTO_REDIRECT_MS)
      return
    }

    errorMessage.value = verifyEmailErrorMessage(result.reason)
    phase.value = 'error'
  } catch (err) {
    errorMessage.value =
      err instanceof HttpError
        ? err.message || 'Не удалось подтвердить email. Попробуйте позже.'
        : 'Не удалось подтвердить email. Попробуйте позже.'
    phase.value = 'error'
  }
}

onMounted(() => {
  const tokenRaw = route.query.token
  const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : ''
  if (!token) {
    errorMessage.value = verifyEmailErrorMessage('empty')
    phase.value = 'error'
    return
  }
  void runVerification(token)
})

onBeforeUnmount(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
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

        <template v-else-if="phase === 'success'">
          <div class="auth-page__icon auth-page__icon--success" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h1 class="auth-page__title">Email подтверждён</h1>
          <p class="auth-page__subtitle">
            Сейчас перенаправим на страницу входа — или нажмите кнопку ниже.
          </p>
          <div class="auth-page__fields">
            <button
              type="button"
              class="auth-page__btn auth-page__btn--primary"
              @click="goToLogin"
            >
              Войти
            </button>
          </div>
        </template>

        <template v-else>
          <h1 class="auth-page__title">Не удалось подтвердить</h1>
          <p v-if="errorMessage" class="auth-page__error" role="alert">
            {{ errorMessage }}
          </p>
          <div class="auth-page__fields">
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
  --auth-fg: #f5f5f5;
  --auth-fg-muted: #a3a3a3;
  --auth-btn-primary-bg: #e5e5e5;
  --auth-btn-primary-fg: #262626;
  --auth-btn-secondary-bg: #404040;
  --auth-btn-secondary-fg: #f5f5f5;
  --auth-radius: 1rem;
  --auth-radius-lg: 1.5rem;
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
  margin: 0 0 var(--auth-space-m);
}

.auth-page__subtitle {
  margin: 0 0 var(--auth-space-xl);
  font-size: 0.875rem;
  color: var(--auth-fg-muted);
  text-align: center;
  line-height: 1.4;
}

.auth-page__error {
  margin: 0 0 var(--auth-space-xl);
  font-size: 0.875rem;
  color: #dc2626;
  text-align: center;
}

.auth-page__loading {
  display: flex;
  justify-content: center;
  padding: var(--auth-space-l) 0;
}

.auth-page__spinner {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: auth-page__spin 0.6s linear infinite;
}

@keyframes auth-page__spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-page__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto var(--auth-space-l);
  border-radius: 50%;
}

.auth-page__icon svg {
  width: 32px;
  height: 32px;
}

.auth-page__icon--success {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
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
</style>
