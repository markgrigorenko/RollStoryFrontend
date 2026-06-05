<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="campaign-init" role="status" aria-live="polite" aria-busy="true">
    <div class="campaign-init__card">
      <span class="campaign-init__spinner" aria-hidden="true" />
      <p class="campaign-init__text">{{ message ?? 'Подготавливаем вашу кампанию…' }}</p>
      <p class="campaign-init__hint">Создаём демо-локации, персонажей и квесты</p>
    </div>
  </div>
</template>

<style scoped>
.campaign-init {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(10, 10, 18, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.campaign-init__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 360px;
  padding: 28px 32px;
  border-radius: 16px;
  background: rgba(33, 33, 33, 0.96);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  text-align: center;
}

.campaign-init__spinner {
  display: inline-block;
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #f97316;
  border-radius: 50%;
  animation: campaign-init-spin 0.7s linear infinite;
}

.campaign-init__text {
  margin: 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}

.campaign-init__hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  line-height: 1.4;
}

@keyframes campaign-init-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
