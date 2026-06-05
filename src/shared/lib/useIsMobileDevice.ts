import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

/** Телефоны и планшеты в портрете: узкий экран + сенсор без hover. */
const MOBILE_MEDIA_QUERY = '(max-width: 900px) and (hover: none) and (pointer: coarse)'

export function useIsMobileDevice() {
  const isMobile = ref(false)
  let mediaQuery: MediaQueryList | null = null

  function sync() {
    isMobile.value = mediaQuery?.matches ?? false
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    sync()
    mediaQuery.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', sync)
  })

  return { isMobile: readonly(isMobile) }
}
