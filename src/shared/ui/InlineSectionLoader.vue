<template>
  <div class="section-loader" role="status" aria-live="polite" aria-busy="true" aria-label="Загрузка">
    <span class="section-loader__spinner" aria-hidden="true" />
  </div>
</template>

<style scoped>
.section-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 160px;
  padding: 24px;
}

.section-loader__spinner {
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #f97316;
  border-radius: 50%;
  animation: section-loader-spin 0.7s linear infinite;
}

@keyframes section-loader-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
