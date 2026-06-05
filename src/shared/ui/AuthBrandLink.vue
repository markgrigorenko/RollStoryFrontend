<script setup lang="ts">
import { useRouter } from 'vue-router'
import { enterDevBypassSession, isDevAuthBypassEnabled } from '@/shared/lib/authSession'
import { resetCampaignSessionState } from '@/shared/lib/resetCampaignSession'

withDefaults(
  defineProps<{
    /** Отступы как на login/register или confirm. */
    variant?: 'login' | 'auth'
  }>(),
  { variant: 'login' }
)

const router = useRouter()
const bypassEnabled = isDevAuthBypassEnabled()

async function onDevEnter() {
  resetCampaignSessionState()
  enterDevBypassSession()
  await router.push({ name: 'map' })
}
</script>

<template>
  <button
    v-if="bypassEnabled"
    type="button"
    class="auth-brand-link"
    :class="`auth-brand-link--${variant}`"
    title="Dev: войти без авторизации"
    @click="onDevEnter"
  >
    RollStory
  </button>
  <a v-else href="/" class="auth-brand-link" :class="`auth-brand-link--${variant}`">RollStory</a>
</template>

<style scoped>
.auth-brand-link {
  position: absolute;
  top: var(--auth-brand-inset, 2rem);
  left: var(--auth-brand-inset, 2rem);
  z-index: 100;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--auth-brand-color, #c97c3a);
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
}

.auth-brand-link--auth {
  --auth-brand-inset: var(--auth-space-xl, 2rem);
  --auth-brand-color: var(--auth-brand, #c97c3a);
}

.auth-brand-link--login {
  --auth-brand-inset: var(--login-space-xl, 2rem);
  --auth-brand-color: var(--login-brand, #c97c3a);
}

.auth-brand-link:hover {
  color: #f39c12;
}

.auth-brand-link:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 4px;
  border-radius: 4px;
}
</style>
