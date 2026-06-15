<script setup lang="ts">
import { computed, ref } from 'vue'

import { DEMO_CLASSES, DEMO_RACES } from '@/types/character-campaign'
import type { components } from '@/shared/api/generated/schema'

type GenerateBody = components['schemas']['GenerateCharacterRequest']

const props = defineProps<{
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'submit', body: GenerateBody): void
  (e: 'cancel'): void
}>()

const PRESETS: { id: GenerateBody['preset']; label: string }[] = [
  { id: 'balanced', label: 'Сбалансированный' },
  { id: 'melee', label: 'Ближний бой' },
  { id: 'finesse', label: 'Ловкость' },
  { id: 'arcane', label: 'Магия (Int)' },
  { id: 'charisma', label: 'Харизма' },
  { id: 'wisdom', label: 'Мудрость' },
]

const useLlm = ref(true)
const prompt = ref('')
const level = ref(1)
const isNpc = ref(false)
const raceIndex = ref(DEMO_RACES[0]!.id)
const classIndex = ref(DEMO_CLASSES[0]!.id)
const preset = ref<NonNullable<GenerateBody['preset']>>('balanced')
const name = ref('')

const localError = ref<string | null>(null)

const levelValid = computed(() => level.value >= 1 && level.value <= 20)

function onSubmit() {
  localError.value = null
  if (!levelValid.value) {
    localError.value = 'Уровень должен быть от 1 до 20.'
    return
  }

  const body: GenerateBody = {
    use_llm: useLlm.value,
    level: level.value,
    is_npc: isNpc.value,
  }

  if (useLlm.value) {
    const p = prompt.value.trim()
    if (p) body.prompt = p
  } else {
    body.race_index = raceIndex.value
    body.class_index = classIndex.value
    body.preset = preset.value
    const n = name.value.trim()
    if (n) body.name = n
  }

  emit('submit', body)
}
</script>

<template>
  <div class="gen-overlay" role="dialog" aria-modal="true" aria-label="Генерация персонажа">
    <div class="gen-modal">
      <header class="gen-modal__head">
        <h2 class="gen-modal__title">Сгенерировать персонажа</h2>
        <button type="button" class="gen-modal__close" aria-label="Закрыть" @click="emit('cancel')">×</button>
      </header>

      <div class="gen-modal__body">
        <div class="gen-modes">
          <button
            type="button"
            class="gen-mode"
            :class="{ 'gen-mode--active': useLlm }"
            @click="useLlm = true"
          >
            LLM
            <span class="gen-mode__hint">с контекстом кампании</span>
          </button>
          <button
            type="button"
            class="gen-mode"
            :class="{ 'gen-mode--active': !useLlm }"
            @click="useLlm = false"
          >
            Механика
            <span class="gen-mode__hint">point-buy по пресету</span>
          </button>
        </div>

        <label class="gen-field">
          <span class="gen-field__label">Уровень (1–20)</span>
          <input v-model.number="level" type="number" min="1" max="20" class="gen-field__input" />
        </label>

        <label class="gen-field gen-field--row">
          <input v-model="isNpc" type="checkbox" class="gen-field__checkbox" />
          <span class="gen-field__label">NPC</span>
        </label>

        <template v-if="useLlm">
          <label class="gen-field">
            <span class="gen-field__label">Пожелание к персонажу (необязательно)</span>
            <textarea
              v-model="prompt"
              class="gen-field__input gen-field__textarea"
              rows="3"
              placeholder="Например: угрюмый ветеран-полуорк, бывший наёмник"
            />
          </label>
        </template>

        <template v-else>
          <label class="gen-field">
            <span class="gen-field__label">Раса</span>
            <select v-model="raceIndex" class="gen-field__input">
              <option v-for="r in DEMO_RACES" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
          </label>
          <label class="gen-field">
            <span class="gen-field__label">Класс</span>
            <select v-model="classIndex" class="gen-field__input">
              <option v-for="c in DEMO_CLASSES" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
          </label>
          <label class="gen-field">
            <span class="gen-field__label">Пресет статов</span>
            <select v-model="preset" class="gen-field__input">
              <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </label>
          <label class="gen-field">
            <span class="gen-field__label">Имя (необязательно)</span>
            <input v-model="name" type="text" maxlength="100" class="gen-field__input" />
          </label>
        </template>

        <p v-if="localError || props.error" class="gen-modal__error" role="alert">
          {{ localError ?? props.error }}
        </p>
      </div>

      <footer class="gen-modal__foot">
        <button type="button" class="gen-btn gen-btn--ghost" :disabled="props.submitting" @click="emit('cancel')">
          Отмена
        </button>
        <button type="button" class="gen-btn gen-btn--primary" :disabled="props.submitting" @click="onSubmit">
          {{ props.submitting ? 'Генерация…' : 'Сгенерировать' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.gen-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.6);
}

.gen-modal {
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: #fafafa;
  overflow: hidden;
}

.gen-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.gen-modal__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.gen-modal__close {
  border: none;
  background: none;
  color: #a3a3a3;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.gen-modal__close:hover {
  color: #fff;
}

.gen-modal__body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.gen-modes {
  display: flex;
  gap: 8px;
}

.gen-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: #222;
  color: #fafafa;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.gen-mode--active {
  border-color: #f97316;
  background: rgba(249, 115, 22, 0.12);
}

.gen-mode__hint {
  font-size: 11px;
  font-weight: 400;
  color: #a3a3a3;
}

.gen-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gen-field--row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.gen-field__label {
  font-size: 13px;
  color: #c4c4c4;
}

.gen-field__input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  background: #121212;
  color: #fafafa;
  font-size: 14px;
  outline: none;
}

.gen-field__input:focus {
  border-color: #f97316;
}

.gen-field__textarea {
  resize: vertical;
}

.gen-field__checkbox {
  width: 16px;
  height: 16px;
  accent-color: #f97316;
}

.gen-modal__error {
  margin: 0;
  font-size: 13px;
  color: #f87171;
}

.gen-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.gen-btn {
  padding: 9px 16px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.gen-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.gen-btn--ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.18);
  color: #d4d4d4;
}

.gen-btn--primary {
  background: #f97316;
  color: #1a1a1a;
}

.gen-btn--primary:not(:disabled):hover {
  background: #fb8a3c;
}
</style>
