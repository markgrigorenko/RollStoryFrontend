import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Overlay якоря в dev давал полоску внизу viewport до resize; DevTools — Option+Shift+D / __devtools__/
    ...(process.env.VITE_ENABLE_VUE_DEVTOOLS === 'true' ? [vueDevTools()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // Запросы с того же origin (localhost), без CORS; в проде нужны заголовки на API.
      '/v1': {
        target: 'https://api.rollstory.org',
        changeOrigin: true,
      },
    },
  },
})
