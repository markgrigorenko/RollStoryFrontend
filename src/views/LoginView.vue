<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoLoginUrl from '@/assets/brand/logo-login.svg'
import { HttpError, login } from '@/shared/api'
import { saveAuthSession } from '@/shared/lib/authSession'
import { resetCampaignSessionState } from '@/shared/lib/resetCampaignSession'
import { getOrCreateDeviceId } from '@/shared/lib/deviceId'
import { isValidEmail } from '@/shared/lib/isValidEmail'
import { savePendingEmailVerification } from '@/shared/lib/pendingEmailVerification'
import { verifyEmailErrorMessage, isVerifyEmailAlreadyUsedReason } from '@/shared/lib/verifyEmailErrors'

// Помогалка: достаёт machine-readable `reason` из тела HttpError (ErrorResponse).
function readReason(err: unknown): string | null {
  if (!(err instanceof HttpError)) return null
  const body = err.body
  if (body && typeof body === 'object' && 'reason' in body) {
    const r = (body as { reason?: unknown }).reason
    return typeof r === 'string' ? r : null
  }
  return null
}
import AuthBrandLink from '@/shared/ui/AuthBrandLink.vue'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const isLoginLoading = ref(false)
const usernameError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const loginError = ref<string | null>(null)

const showRegisteredHint = computed(() => {
  if (route.query.verified === '1') return true
  if (route.query.registered === '1') return true
  const reason = route.query.reason
  if (typeof reason === 'string' && isVerifyEmailAlreadyUsedReason(reason)) return true
  return false
})

const verifyEmailError = computed(() => {
  const reason = route.query.reason
  if (typeof reason !== 'string' || !reason.trim()) return null
  if (isVerifyEmailAlreadyUsedReason(reason)) return null
  return verifyEmailErrorMessage(reason.trim())
})

const registeredHintText = computed(() => {
  const reason = route.query.reason
  if (typeof reason === 'string' && isVerifyEmailAlreadyUsedReason(reason)) {
    return 'Email уже подтверждён. Войдите с тем же email и паролем.'
  }
  return route.query.verified === '1'
    ? 'Email подтверждён. Войдите с тем же email и паролем.'
    : 'Аккаунт создан. Войдите с тем же email и паролем.'
})

const registeredHintWrapRef = ref<HTMLDivElement | null>(null)
const confettiCanvasRef = ref<HTMLCanvasElement | null>(null)
let stopConfetti: (() => void) | null = null

type ConfettiParticle = {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
}

function runLightConfetti(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  reducedMotion: boolean
): () => void {
  if (reducedMotion) return () => {}

  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) return () => {}
  const c = maybeCtx

  const hint = wrap.getBoundingClientRect()
  if (hint.width < 8) return () => {}

  const vw = window.innerWidth
  const vh = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2)

  canvas.style.width = `${vw}px`
  canvas.style.height = `${vh}px`
  canvas.width = Math.floor(vw * dpr)
  canvas.height = Math.floor(vh * dpr)
  c.setTransform(dpr, 0, 0, dpr, 0, 0)

  const colors = ['#fbbf24', '#f97316', '#34d399', '#e5e7eb', '#fcd34d', '#fb923c']
  const particles: ConfettiParticle[] = []
  const count = 56
  const spawnPad = 12
  for (let i = 0; i < count; i++) {
    particles.push({
      x:
        hint.left -
        spawnPad +
        Math.random() * (hint.width + spawnPad * 2),
      y: hint.top + Math.random() * Math.min(hint.height + 8, 48),
      vx: (Math.random() - 0.5) * 2.8,
      vy: 0.35 + Math.random() * 1.8,
      w: 3 + Math.random() * 5,
      h: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.12,
      color: colors[i % colors.length]!,
    })
  }

  const start = performance.now()
  const maxMs = 14000
  let raf = 0

  function frame(now: number) {
    const elapsed = now - start
    c.clearRect(0, 0, vw, vh)

    let allBelow = true
    const fadeFrom = vh * 0.86

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.065
      p.vx *= 0.998
      p.rot += p.vr

      if (p.y <= vh + 48) allBelow = false

      let alpha = 1
      if (p.y > fadeFrom) {
        alpha = Math.max(0, 1 - (p.y - fadeFrom) / (vh * 0.14 + 64))
      }

      if (alpha <= 0.01) continue

      c.save()
      c.translate(p.x, p.y)
      c.rotate(p.rot)
      c.globalAlpha = alpha
      c.fillStyle = p.color
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      c.restore()
    }

    const done =
      (allBelow && elapsed > 900) || elapsed > maxMs

    if (!done) {
      raf = requestAnimationFrame(frame)
    } else {
      c.clearRect(0, 0, vw, vh)
    }
  }

  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

watch(
  showRegisteredHint,
  async (show) => {
    stopConfetti?.()
    stopConfetti = null
    if (!show) return
    await nextTick()
    requestAnimationFrame(() => {
      const canvas = confettiCanvasRef.value
      const wrap = registeredHintWrapRef.value
      if (!canvas || !wrap) return
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stopConfetti = runLightConfetti(canvas, wrap, reducedMotion)
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopConfetti?.()
})

function clearUsernameError() {
  usernameError.value = null
  loginError.value = null
}

function clearPasswordError() {
  passwordError.value = null
  loginError.value = null
}

async function handleLogin() {
  if (isLoginLoading.value) return
  loginError.value = null
  usernameError.value = null
  passwordError.value = null
  const u = username.value.trim()
  const p = password.value
  if (!u) usernameError.value = 'Укажите электронную почту'
  else if (!isValidEmail(u)) usernameError.value = 'Введите корректный email'
  if (!p) passwordError.value = 'Заполните пароль'
  if (usernameError.value || passwordError.value) return
  isLoginLoading.value = true
  try {
    const deviceId = getOrCreateDeviceId()
    const res = await login({ email: u, password: p }, deviceId)
    resetCampaignSessionState()
    saveAuthSession(res)
    await router.replace({ name: 'map' })
  } catch (err) {
    // Спец-кейс: креды верные, но email не подтверждён. Бэк кладёт
    // reason: "email_not_verified" в ErrorResponse. Сохраняем email в
    // pending и переводим на экран «проверьте почту» — там есть кнопка
    // повторной отправки письма.
    if (readReason(err) === 'email_not_verified') {
      savePendingEmailVerification({ email: u })
      await router.push({ name: 'confirmEmail' })
      return
    }
    if (err instanceof HttpError) {
      loginError.value =
        err.status === 401
          ? err.message || 'Неверный email или пароль'
          : err.message || 'Не удалось войти. Попробуйте позже.'
    } else {
      loginError.value = 'Не удалось войти. Попробуйте позже.'
    }
  } finally {
    isLoginLoading.value = false
  }
}

function handleRegister() {
  router.push({ name: 'register' })
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
        <h1 class="login-page__title">Вход</h1>

        <form class="login-page__fields" @submit.prevent="handleLogin">
          <p
            v-if="verifyEmailError"
            class="login-page__error login-page__error--form"
            role="alert"
          >
            <span class="login-page__error-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            {{ verifyEmailError }}
          </p>
          <div
            v-if="showRegisteredHint"
            ref="registeredHintWrapRef"
            class="login-page__hint-wrap"
          >
            <p class="login-page__hint login-page__hint--success" role="status">
              <span class="login-page__hint-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle cx="12" cy="12" r="10" fill="#16a34a" />
                  <path
                    d="M8 12.35 10.65 15 16 9.65"
                    stroke="#ecfdf5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="login-page__hint-text">
                {{ registeredHintText }}
              </span>
            </p>
          </div>
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
              :disabled="isLoginLoading"
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
          <div class="login-page__input-group">
            <input
              v-model="password"
              type="password"
              class="login-page__input"
              :class="{ 'login-page__input--error': passwordError }"
              placeholder="Пароль"
              autocomplete="current-password"
              :disabled="isLoginLoading"
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
            <p v-if="loginError" class="login-page__error" role="alert">
              <span class="login-page__error-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              {{ loginError }}
            </p>
          </div>

          <button
            type="submit"
            class="login-page__btn login-page__btn--primary"
            :disabled="isLoginLoading"
            :aria-busy="isLoginLoading"
          >
            <span
              v-if="isLoginLoading"
              class="login-page__spinner"
              aria-hidden="true"
            />
            <span v-else>Войти</span>
          </button>
          <button
            type="button"
            class="login-page__btn login-page__btn--secondary"
            @click="handleRegister"
          >
            Зарегистрироваться
          </button>
        </form>
      </div>
    </main>

    <canvas
      v-if="showRegisteredHint"
      ref="confettiCanvasRef"
      class="login-page__confetti"
      aria-hidden="true"
    />
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

/* Декоративный фон */
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

/* Бренд */
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

/* Форма */
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

.login-page__hint-wrap {
  margin: 0;
}

.login-page__confetti {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.login-page__hint {
  margin: 0;
  padding: var(--login-space-s) var(--login-space-m);
  font-size: 0.875rem;
  color: var(--login-fg-muted);
  background: rgba(230, 126, 34, 0.12);
  border-radius: var(--login-radius);
  border: 1px solid rgba(230, 126, 34, 0.25);
}

.login-page__hint--success {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: var(--login-space-m) var(--login-space-l);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.45;
  color: #fffaf5;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  background: linear-gradient(
    145deg,
    rgba(230, 126, 34, 0.42) 0%,
    rgba(22, 163, 74, 0.28) 55%,
    rgba(38, 38, 38, 0.5) 100%
  );
  border: 1px solid rgba(251, 191, 36, 0.55);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 10px 28px rgba(230, 126, 34, 0.22),
    0 0 24px rgba(251, 191, 36, 0.12);
}

.login-page__hint-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 8px rgba(22, 163, 74, 0.5));
}

.login-page__hint-icon svg {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
}

.login-page__hint-text {
  flex: 1;
  min-width: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .login-page__hint--success {
    animation: login-page__hint-success-in 0.55s ease-out both;
  }
}

@keyframes login-page__hint-success-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
    filter: saturate(0.85);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: saturate(1);
  }
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
