<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import logoLoginUrl from '@/assets/brand/logo-login.svg'
import { HttpError, signUp, verifyEmail } from '@/shared/api'
import AuthBrandLink from '@/shared/ui/AuthBrandLink.vue'
import { isValidEmail } from '@/shared/lib/isValidEmail'
import {
  clearPendingEmailVerification,
  savePendingEmailVerification,
} from '@/shared/lib/pendingEmailVerification'

const router = useRouter()
const username = ref('')
const password = ref('')
const passwordRepeat = ref('')
const isRegisterLoading = ref(false)
const usernameError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const passwordRepeatError = ref<string | null>(null)
const registerError = ref<string | null>(null)

/** Игнорируем устаревшие ответы при повторном сабмите или гонке двойного клика. */
let registerAttempt = 0
let registerAbort: AbortController | null = null

function clearUsernameError() {
  usernameError.value = null
  registerError.value = null
}

function clearPasswordError() {
  passwordError.value = null
  registerError.value = null
}

function clearPasswordRepeatError() {
  passwordRepeatError.value = null
  registerError.value = null
}

function validateForm(): boolean {
  usernameError.value = null
  passwordError.value = null
  passwordRepeatError.value = null
  registerError.value = null
  const u = username.value.trim()
  const p = password.value
  const pr = passwordRepeat.value.trim()
  if (!u) usernameError.value = 'Укажите электронную почту'
  else if (!isValidEmail(u)) usernameError.value = 'Введите корректный email'
  if (!p) passwordError.value = 'Заполните пароль'
  else if (p.length < 8) passwordError.value = 'Пароль — не менее 8 символов'
  if (!pr) passwordRepeatError.value = 'Повторите пароль'
  if (usernameError.value || passwordError.value || passwordRepeatError.value) return false
  if (password.value !== passwordRepeat.value) {
    passwordRepeatError.value = 'Пароли не совпадают'
    return false
  }
  return true
}

async function handleRegister() {
  if (isRegisterLoading.value) return
  usernameError.value = null
  passwordError.value = null
  passwordRepeatError.value = null
  registerError.value = null

  if (!validateForm()) return

  registerAbort?.abort()
  const attemptId = ++registerAttempt
  const signal = (registerAbort = new AbortController()).signal

  isRegisterLoading.value = true
  try {
    const email = username.value.trim()
    const res = await signUp(
      {
        email,
        password: password.value,
      },
      signal
    )

    if (attemptId !== registerAttempt) return

    if (res.verification_token) {
      const result = await verifyEmail(res.verification_token, signal)
      if (attemptId !== registerAttempt) return

      if (
        result.status === 'success' ||
        (result.status === 'error' && result.reason === 'used')
      ) {
        clearPendingEmailVerification()
        await router.push({ name: 'login', query: { verified: '1' } })
        return
      }
      savePendingEmailVerification({
        userId: res.userId,
        email,
        verificationToken: res.verification_token,
      })
      await router.push({
        name: 'confirmEmail',
        query: { reason: result.reason },
      })
      return
    }

    savePendingEmailVerification({ userId: res.userId, email })
    await router.push({ name: 'confirmEmail' })
  } catch (err) {
    if (attemptId !== registerAttempt) return
    if (err instanceof DOMException && err.name === 'AbortError') return

    if (err instanceof HttpError) {
      if (err.status === 400 || err.status === 401 || err.status === 409) {
        usernameError.value = err.message
      } else {
        registerError.value = err.message || 'Не удалось зарегистрироваться. Попробуйте позже.'
      }
    } else {
      registerError.value = 'Не удалось зарегистрироваться. Попробуйте позже.'
    }
  } finally {
    if (attemptId === registerAttempt) {
      isRegisterLoading.value = false
    }
  }
}

function handleLogin() {
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__bg" aria-hidden="true">
      <img :src="logoLoginUrl" alt="" class="login-page__bg-logo" />
    </div>

    <AuthBrandLink variant="login" />

    <main class="login-page__form-wrapper">
      <div class="login-page__form">
        <h1 class="login-page__title">Регистрация</h1>

        <form class="login-page__fields" @submit.prevent="handleRegister">
          <p v-if="registerError" class="login-page__error login-page__error--form" role="alert">
            <span class="login-page__error-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            {{ registerError }}
          </p>
          <div class="login-page__input-group">
            <input
              v-model="username"
              type="email"
              class="login-page__input"
              :class="{ 'login-page__input--error': usernameError }"
              placeholder="Электронная почта"
              autocomplete="email"
              inputmode="email"
              autocapitalize="off"
              spellcheck="false"
              maxlength="254"
              :disabled="isRegisterLoading"
              @input="clearUsernameError"
            />
            <p v-if="usernameError" class="login-page__error" role="alert">
              <span class="login-page__error-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              {{ usernameError }}
            </p>
          </div>
          <input
            v-model="password"
            type="password"
            class="login-page__input"
            :class="{ 'login-page__input--error': passwordError }"
            placeholder="Пароль"
            autocomplete="new-password"
            :disabled="isRegisterLoading"
            @input="clearPasswordError"
          />
          <p v-if="passwordError" class="login-page__error" role="alert">
            <span class="login-page__error-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            {{ passwordError }}
          </p>
          <div class="login-page__input-group">
            <input
              v-model="passwordRepeat"
              type="password"
              class="login-page__input"
              :class="{ 'login-page__input--error': passwordRepeatError }"
              placeholder="Повторите пароль"
              autocomplete="new-password"
              :disabled="isRegisterLoading"
              @input="clearPasswordRepeatError"
            />
            <p v-if="passwordRepeatError" class="login-page__error" role="alert">
              <span class="login-page__error-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              {{ passwordRepeatError }}
            </p>
          </div>

          <button
            type="submit"
            class="login-page__btn login-page__btn--primary"
            :disabled="isRegisterLoading"
            :aria-busy="isRegisterLoading"
          >
            <span
              v-if="isRegisterLoading"
              class="login-page__spinner"
              aria-hidden="true"
            />
            <span v-else>Зарегистрироваться</span>
          </button>
          <button
            type="button"
            class="login-page__btn login-page__btn--secondary"
            @click="handleLogin"
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  --login-bg: #1a1a1a;
  --login-panel: #262626;
  --login-input-bg: #1f1f1f;
  --login-border: rgba(255, 255, 255, 0.08);
  --login-fg: #f5f5f5;
  --login-fg-muted: #a3a3a3;
  --login-brand: #e67e22;
  --login-btn-primary-bg: #e5e5e5;
  --login-btn-primary-fg: #262626;
  --login-btn-secondary-bg: #404040;
  --login-btn-secondary-fg: #f5f5f5;
  --login-error: #dc2626;
  --login-radius: 1rem;
  --login-radius-lg: 1.5rem;
  --login-space-s: 0.5rem;
  --login-space-m: 1rem;
  --login-space-l: 1.5rem;
  --login-space-xl: 2rem;
  --login-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);

  position: fixed;
  inset: 0;
  width: 100%;
  background: var(--login-bg);
  color: var(--login-fg);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.login-page__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.login-page__bg-logo {
  position: absolute;
  top: 0;
  left: 0;
  width: 57%;
  height: calc(100% - 16px);
  object-fit: contain;
  object-position: left bottom;
}

.login-page__brand {
  position: absolute;
  top: var(--login-space-xl);
  left: var(--login-space-xl);
  color: var(--login-brand);
  font-size: 1.25rem;
  font-weight: 500;
  text-decoration: none;
  letter-spacing: 0.02em;
  z-index: 1;
}

.login-page__brand:hover {
  color: #f39c12;
}

.login-page__form-wrapper {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--login-space-xl);
}

.login-page__form {
  width: 100%;
  max-width: 360px;
  background: var(--login-panel);
  border-radius: var(--login-radius-lg);
  box-shadow: var(--login-shadow);
  padding: var(--login-space-xl);
}

.login-page__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--login-fg);
  text-align: center;
  margin: 0 0 var(--login-space-xl);
}

.login-page__fields {
  display: flex;
  flex-direction: column;
  gap: var(--login-space-m);
  align-items: stretch;
}

.login-page__input {
  width: 100%;
  padding: var(--login-space-m) var(--login-space-l);
  background: var(--login-input-bg);
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius);
  color: var(--login-fg);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.login-page__input::placeholder {
  color: var(--login-fg-muted);
}

.login-page__input:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.login-page__input:focus {
  border-color: var(--login-brand);
  box-shadow: 0 0 0 2px rgba(230, 126, 34, 0.25);
}

.login-page__input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.login-page__input--error {
  border-color: var(--login-error);
  box-shadow: 0 0 0 1px var(--login-error);
}

.login-page__input--error:focus {
  border-color: var(--login-error);
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
}

.login-page__input-group {
  display: flex;
  flex-direction: column;
  gap: var(--login-space-s);
}

.login-page__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.875rem;
  color: var(--login-error);
}

.login-page__error-icon {
  display: inline-flex;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  color: var(--login-error);
}

.login-page__error-icon svg {
  width: 1rem;
  height: 1rem;
}

.login-page__error--form {
  margin: 0;
  padding: var(--login-space-s) var(--login-space-m);
  background: rgba(220, 38, 38, 0.12);
  border-radius: var(--login-radius);
}

.login-page__btn {
  width: 100%;
  padding: var(--login-space-m) var(--login-space-l);
  border: none;
  border-radius: var(--login-radius);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.05s;
}

.login-page__btn:active {
  transform: scale(0.99);
}

.login-page__btn--primary {
  background: var(--login-btn-primary-bg);
  color: var(--login-btn-primary-fg);
}

.login-page__btn--primary:hover:not(:disabled) {
  background: #d4d4d4;
}

.login-page__btn:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.login-page__spinner {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: login-page__spin 0.6s linear infinite;
  vertical-align: -0.25em;
}

@keyframes login-page__spin {
  to {
    transform: rotate(360deg);
  }
}

.login-page__btn--secondary {
  background: var(--login-btn-secondary-bg);
  color: var(--login-btn-secondary-fg);
}

.login-page__btn--secondary:hover {
  background: #525252;
}
</style>
