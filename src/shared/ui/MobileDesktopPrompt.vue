<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const prefersReducedMotion = ref(false)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
})

const motionClass = computed(() =>
  prefersReducedMotion.value ? 'mobile-prompt--reduced-motion' : ''
)
</script>

<template>
  <Teleport to="body">
    <div
      class="mobile-prompt"
      :class="motionClass"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-prompt-title"
      aria-describedby="mobile-prompt-desc"
    >
      <div class="mobile-prompt__backdrop" aria-hidden="true" />

      <div class="mobile-prompt__card">
        <div class="mobile-prompt__illustration" aria-hidden="true">
          <svg
            class="mobile-prompt__svg"
            viewBox="0 0 310 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker
                id="mobile-prompt-arrowhead"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path
                  d="M0 1 L8 5 L0 9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </marker>
            </defs>

            <g class="mobile-prompt__phone">
              <rect
                x="8"
                y="18"
                width="48"
                height="84"
                rx="10"
                stroke="currentColor"
                stroke-width="2.5"
              />
              <rect
                x="15"
                y="30"
                width="34"
                height="54"
                rx="4"
                fill="currentColor"
                opacity="0.15"
              />
              <circle cx="32" cy="92" r="3" fill="currentColor" opacity="0.5" />
            </g>

            <path
              class="mobile-prompt__arrow"
              d="M72 60 C128 32, 182 32, 238 60"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-dasharray="6 5"
              marker-end="url(#mobile-prompt-arrowhead)"
            />

            <g class="mobile-prompt__desktop">
              <rect
                x="252"
                y="28"
                width="50"
                height="40"
                rx="5"
                stroke="currentColor"
                stroke-width="2.5"
              />
              <rect
                x="257"
                y="34"
                width="40"
                height="28"
                rx="3"
                class="mobile-prompt__screen"
              />
              <path
                d="M269 76 L285 76 L281 88 L273 88 Z"
                fill="currentColor"
                opacity="0.35"
              />
            </g>
          </svg>
        </div>

        <h1 id="mobile-prompt-title" class="mobile-prompt__title">
          Откройте на компьютере
        </h1>
        <p id="mobile-prompt-desc" class="mobile-prompt__text">
          RollStory создан для большого экрана — карта, квесты и заметки удобнее
          на ноутбуке или ПК.
        </p>

        <p class="mobile-prompt__hint">
          Скопируйте адрес сайта и откройте его в браузере на компьютере.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-prompt {
  --prompt-brand: #c97c3a;
  --prompt-brand-light: #f97316;
  --prompt-surface: rgba(24, 20, 18, 0.92);
  --prompt-text: #f5f0eb;
  --prompt-muted: rgba(245, 240, 235, 0.72);

  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  color: var(--prompt-text);
  animation: prompt-fade-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.mobile-prompt__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse 120% 80% at 50% 0%,
      rgba(201, 124, 58, 0.28),
      transparent 55%
    ),
    radial-gradient(
      ellipse 90% 60% at 80% 100%,
      rgba(249, 115, 22, 0.18),
      transparent 50%
    ),
    linear-gradient(165deg, #1a1410 0%, #0f0c0a 45%, #18120e 100%);
  animation: prompt-backdrop-shift 8s ease-in-out infinite alternate;
}

.mobile-prompt__card {
  position: relative;
  width: min(100%, 22rem);
  padding: 2rem 1.75rem 1.75rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(201, 124, 58, 0.28);
  background: var(--prompt-surface);
  backdrop-filter: blur(14px);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  text-align: center;
  animation: prompt-card-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
}

.mobile-prompt__illustration {
  margin: 0 auto 1.5rem;
  color: var(--prompt-brand-light);
  animation: prompt-item-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
}

.mobile-prompt__svg {
  display: block;
  width: min(100%, 17.5rem);
  margin: 0 auto;
}

.mobile-prompt__phone {
  transform-origin: 32px 60px;
  animation: prompt-float-phone 3.2s ease-in-out infinite;
}

.mobile-prompt__desktop {
  transform-origin: 277px 48px;
  animation: prompt-float-desktop 3.2s ease-in-out 0.4s infinite;
}

.mobile-prompt__screen {
  fill: var(--prompt-brand-light);
  opacity: 0.35;
  animation: prompt-screen-glow 2.4s ease-in-out infinite;
}

.mobile-prompt__arrow {
  opacity: 0.85;
  animation: prompt-arrow-dash 1.8s linear infinite;
}

.mobile-prompt__title {
  margin: 0 0 0.75rem;
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  animation: prompt-item-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
}

.mobile-prompt__text {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--prompt-muted);
  animation: prompt-item-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.38s both;
}

.mobile-prompt__hint {
  margin: 0;
  padding-top: 1rem;
  border-top: 1px solid rgba(201, 124, 58, 0.2);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(245, 240, 235, 0.55);
  animation: prompt-item-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.46s both;
}

.mobile-prompt--reduced-motion,
.mobile-prompt--reduced-motion * {
  animation: none !important;
  transition: none !important;
}

@keyframes prompt-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes prompt-card-rise {
  from {
    opacity: 0;
    transform: translateY(1.5rem) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes prompt-item-in {
  from {
    opacity: 0;
    transform: translateY(0.75rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes prompt-backdrop-shift {
  from {
    filter: hue-rotate(0deg) brightness(1);
  }
  to {
    filter: hue-rotate(8deg) brightness(1.06);
  }
}

@keyframes prompt-float-phone {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-5px) rotate(1deg);
  }
}

@keyframes prompt-float-desktop {
  0%,
  100% {
    transform: translateY(0) rotate(1deg);
  }
  50% {
    transform: translateY(-6px) rotate(-1deg);
  }
}

@keyframes prompt-screen-glow {
  0%,
  100% {
    opacity: 0.28;
  }
  50% {
    opacity: 0.65;
  }
}

@keyframes prompt-arrow-dash {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -22;
  }
}

</style>
