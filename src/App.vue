<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { useIsMobileDevice } from '@/shared/lib/useIsMobileDevice'
import MobileDesktopPrompt from '@/shared/ui/MobileDesktopPrompt.vue'

const route = useRoute()
const isMapPage = () => route.name === 'map'

const AUTH_ROUTE_NAMES = new Set(['login', 'register', 'confirmEmail'])
const isAuthPage = () =>
  typeof route.name === 'string' && AUTH_ROUTE_NAMES.has(route.name)

const { isMobile } = useIsMobileDevice()
</script>

<template>
  <div
    class="app-wrapper"
    :class="{
      'app-wrapper--fullscreen': isMapPage(),
      'app-wrapper--auth': isAuthPage(),
    }"
  >
    <RouterView />
    <MobileDesktopPrompt v-if="isMobile" />
  </div>
</template>

<style scoped>
.app-wrapper {
  min-height: 100%;
}

.app-wrapper--fullscreen {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-wrapper--fullscreen > * {
  flex: 1;
  min-height: 0;
}

.app-wrapper--auth {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #1a1a1a;
}
</style>

<style>
/* без scoped: сброс отступов #app. Нельзя ставить display:block — иначе ломается flex из scoped
   (карта не получает высоту, Leaflet считает размер 0 и «влезание целиком» даёт неверный зум). */
.app-wrapper--fullscreen {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}
</style>
