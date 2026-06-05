<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import type { AbilityScoreKey, CharacterCreateDraft, CharacterSheet } from '@/types/character-campaign'
import {
  ABILITY_SCORE_KEYS,
  CREATOR_SKILL_OPTIONS,
  DEMO_CLASSES,
  DEMO_RACES,
  POINT_BUY_BUDGET,
  previewCharacterSheetFromDraft,
  remainingPointsFromScores,
  SKILL_CHOICE_COUNT,
  totalPointCost,
} from '@/types/character-campaign'
import { uploadFile } from '@/shared/api/filesApi'
import { ABILITY_TO_API } from '@/shared/lib/characterCreateMappers'
import {
  useCharacterCreationSessionStore,
  type CharacterCreateRewindableStep,
} from '@/stores/characterCreationSession'
import { useActiveCampaignStore } from '@/stores/activeCampaign'

const draft = defineModel<CharacterCreateDraft>({ required: true })

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'complete', payload?: { characterId?: string; avatarUploadError?: string; avatarUrl?: string }): void
}>()

type StepKey = 'basic' | 'stats' | 'asi' | 'prof' | 'equip' | 'review'

const creationStore = useCharacterCreationSessionStore()
const { hasSession, needsAsiStep, proficiencyGroups, proficiencySelections, submitting, lastError, totalAsiPoints, asiAllocations } =
  storeToRefs(creationStore)

const stepOrder = computed((): StepKey[] => {
  const order: StepKey[] = ['basic', 'stats']
  if (hasSession.value && needsAsiStep.value) order.push('asi')
  order.push('prof', 'equip', 'review')
  return order
})

const wizardSteps = computed(() => {
  const labels: Record<StepKey, string> = {
    basic: 'Основная информация',
    stats: 'Характеристики',
    asi: 'Улучшения (ASI)',
    prof: 'Владения',
    equip: 'Снаряжение',
    review: 'Итог',
  }
  return stepOrder.value.map((key, i) => ({ n: i + 1, key, label: labels[key] }))
})

const ABILITY_LABELS: Record<AbilityScoreKey, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
}

const currentStep = ref(1)

const step1Error = ref('')
const step1AvatarError = ref('')
const step2Error = ref('')
const step3Error = ref('')
const stepAsiError = ref('')
const avatarFileInput = ref<HTMLInputElement | null>(null)
const avatarObjectUrl = ref<string | null>(null)
const avatarUploading = ref(false)
const avatarUploadError = ref('')

const currentStepKey = computed(() => stepOrder.value[currentStep.value - 1] ?? 'basic')

const raceOptions = computed(() =>
  hasSession.value && creationStore.raceOptions.length > 0
    ? creationStore.raceOptions
    : DEMO_RACES
)
const classOptions = computed(() =>
  hasSession.value && creationStore.classOptions.length > 0
    ? creationStore.classOptions
    : DEMO_CLASSES
)

const ASI_STAT_OPTIONS = computed(() =>
  ABILITY_SCORE_KEYS.map((key) => ({
    key,
    apiIndex: ABILITY_TO_API[key],
    label: ABILITY_LABELS[key],
  }))
)

onMounted(() => {
  void (async () => {
    const ok = await creationStore.begin()
    if (ok) {
      const r = creationStore.raceOptions[0]
      const c = creationStore.classOptions[0]
      if (r) draft.value = { ...draft.value, raceId: r.id }
      if (c) draft.value = { ...draft.value, classId: c.id }
    }
  })()
})

watch(
  () => draft.value.pendingAvatarFile,
  (file) => {
    if (avatarObjectUrl.value) {
      URL.revokeObjectURL(avatarObjectUrl.value)
      avatarObjectUrl.value = null
    }
    if (file) {
      avatarObjectUrl.value = URL.createObjectURL(file)
    }
  }
)

onUnmounted(() => {
  if (avatarObjectUrl.value) {
    URL.revokeObjectURL(avatarObjectUrl.value)
  }
  creationStore.reset()
})

const selectedSkillCount = computed(() => draft.value.proficientSkillIds.length)

const canGoNextFromStep1 = computed(() => draft.value.name.trim().length > 0)

const remainingPoints = computed(() => remainingPointsFromScores(draft.value.abilityScores))

const previewSheet = computed((): CharacterSheet => {
  const sheet = previewCharacterSheetFromDraft(draft.value)
  if (avatarObjectUrl.value) {
    return { ...sheet, portraitUrl: avatarObjectUrl.value }
  }
  return sheet
})

function adjustAbility(key: AbilityScoreKey, delta: 1 | -1) {
  const cur = draft.value.abilityScores[key]
  const next = cur + delta
  if (next < 8 || next > 15) return
  const nextScores = { ...draft.value.abilityScores, [key]: next }
  if (delta === 1) {
    const cost = totalPointCost(nextScores)
    if (cost > POINT_BUY_BUDGET) return
  }
  draft.value = { ...draft.value, abilityScores: nextScores }
  step2Error.value = ''
}

function asiPointsForStat(apiIndex: string): number {
  return asiAllocations.value.find((a) => a.statIndex === apiIndex)?.points ?? 0
}

function adjustAsi(apiIndex: string, delta: 1 | -1) {
  const cur = [...asiAllocations.value]
  const i = cur.findIndex((a) => a.statIndex === apiIndex)
  const spent = creationStore.asiPointsSpent()
  const current = i >= 0 ? cur[i]!.points : 0
  const next = current + delta
  if (next < 0 || next > 2) return
  if (delta > 0 && spent + delta > totalAsiPoints.value) return

  if (next === 0) {
    if (i >= 0) cur.splice(i, 1)
  } else if (i >= 0) {
    cur[i] = { statIndex: apiIndex, points: next as 1 | 2 }
  } else {
    cur.push({ statIndex: apiIndex, points: next as 1 | 2 })
  }
  asiAllocations.value = cur
  stepAsiError.value = ''
}

async function goNext() {
  const key = currentStepKey.value

  if (key === 'basic') {
    if (!canGoNextFromStep1.value) {
      step1Error.value = 'Введите имя персонажа'
      return
    }
    step1Error.value = ''
    if (hasSession.value) {
      const ok = await creationStore.submitBasicInfo(draft.value)
      if (!ok) return
    }
  }

  if (key === 'stats') {
    if (remainingPointsFromScores(draft.value.abilityScores) !== 0) {
      step2Error.value = 'Распределите все 27 очков.'
      return
    }
    step2Error.value = ''
    if (hasSession.value) {
      const ok = await creationStore.submitPointBuy(draft.value)
      if (!ok) return
    }
  }

  if (key === 'asi') {
    if (!creationStore.asiValid()) {
      stepAsiError.value = `Распределите все ${totalAsiPoints.value} очков ASI.`
      return
    }
    stepAsiError.value = ''
    const ok = await creationStore.submitAsi()
    if (!ok) return
  }

  if (key === 'prof') {
    if (hasSession.value) {
      if (!creationStore.proficienciesValid()) {
        step3Error.value = 'Выберите все обязательные владения.'
        return
      }
      step3Error.value = ''
      const ok = await creationStore.submitProficiencies()
      if (!ok) return
    } else if (draft.value.proficientSkillIds.length !== SKILL_CHOICE_COUNT) {
      step3Error.value = `Выберите ровно ${SKILL_CHOICE_COUNT} навыка.`
      return
    }
    step3Error.value = ''
  }

  if (currentStep.value < stepOrder.value.length) {
    currentStep.value += 1
  }
}

function isRewindableStep(key: StepKey | undefined): key is CharacterCreateRewindableStep {
  return key === 'basic' || key === 'stats' || key === 'asi' || key === 'prof'
}

async function goBack() {
  if (currentStep.value <= 1 || submitting.value) return

  const newStep = currentStep.value - 1
  const targetKey = stepOrder.value[newStep - 1]

  if (hasSession.value && isRewindableStep(targetKey)) {
    const ok = await creationStore.rewindToWizardStep(targetKey)
    if (!ok) return
  }

  currentStep.value = newStep
  step1Error.value = ''
  step2Error.value = ''
  step3Error.value = ''
  stepAsiError.value = ''
}

function onSkillToggle(skillId: string, checked: boolean): boolean {
  const cur = [...draft.value.proficientSkillIds]
  if (checked) {
    if (cur.length >= SKILL_CHOICE_COUNT) return false
    if (!cur.includes(skillId)) cur.push(skillId)
  } else {
    const i = cur.indexOf(skillId)
    if (i >= 0) cur.splice(i, 1)
  }
  draft.value = { ...draft.value, proficientSkillIds: cur }
  step3Error.value = ''
  return true
}

function isSkillCheckboxDisabled(skillId: string): boolean {
  return (
    selectedSkillCount.value >= SKILL_CHOICE_COUNT && !draft.value.proficientSkillIds.includes(skillId)
  )
}

function onSkillCheckboxChange(skillId: string, e: Event) {
  const t = e.target as HTMLInputElement | null
  if (!t) return
  const applied = onSkillToggle(skillId, t.checked)
  if (!applied) t.checked = false
}

function promptAvatarUpload() {
  avatarFileInput.value?.click()
}

function onAvatarSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    step1AvatarError.value = 'Выберите файл изображения'
    return
  }
  step1AvatarError.value = ''
  draft.value = { ...draft.value, pendingAvatarFile: file }
}

function clearAvatar() {
  step1AvatarError.value = ''
  draft.value = { ...draft.value, pendingAvatarFile: null }
}

async function onPrimaryAction() {
  if (currentStepKey.value !== 'review') {
    await goNext()
    return
  }
  avatarUploadError.value = ''
  if (hasSession.value) {
    const characterId = await creationStore.finish()
    if (!characterId) return

    let uploadError: string | undefined
    let avatarUrl: string | undefined
    if (draft.value.pendingAvatarFile) {
      avatarUploading.value = true
      try {
        const campaignId = await useActiveCampaignStore().ensureCampaignId()
        if (!campaignId) {
          throw new Error('Не удалось определить кампанию для загрузки аватара')
        }
        const uploaded = await uploadFile({
          campaignId,
          kind: 'character',
          characterId,
          file: draft.value.pendingAvatarFile,
        })
        avatarUrl = uploaded.url
      } catch (e) {
        uploadError =
          e instanceof Error ? e.message : 'Персонаж создан, но аватар не загрузился.'
        avatarUploadError.value = uploadError
      } finally {
        avatarUploading.value = false
      }
    }
    emit('complete', { characterId, avatarUploadError: uploadError, avatarUrl })
    return
  }
  emit('complete')
}

function primaryLabel() {
  if (currentStepKey.value === 'review') {
    if (submitting.value) return 'Создание…'
    if (avatarUploading.value) return 'Загрузка аватара…'
    return 'Создать персонажа'
  }
  return submitting.value ? 'Сохранение…' : 'Дальше'
}

const primaryBusy = computed(() => submitting.value || avatarUploading.value)

function isProficiencyChecked(groupId: string, optionIndex: string): boolean {
  return (proficiencySelections.value[groupId] ?? []).includes(optionIndex)
}

function proficiencyGroupCount(groupId: string): number {
  return proficiencySelections.value[groupId]?.length ?? 0
}

function isProficiencyCheckboxDisabled(groupId: string, optionIndex: string, maxChoose: number): boolean {
  return (
    proficiencyGroupCount(groupId) >= maxChoose && !isProficiencyChecked(groupId, optionIndex)
  )
}

function onProficiencyChange(groupId: string, optionIndex: string, maxChoose: number, e: Event) {
  const t = e.target as HTMLInputElement | null
  if (!t) return
  const wasChecked = isProficiencyChecked(groupId, optionIndex)
  if (t.checked && !wasChecked) {
    if (proficiencyGroupCount(groupId) >= maxChoose) {
      t.checked = false
      return
    }
    creationStore.toggleProficiency(groupId, optionIndex, maxChoose)
    return
  }
  if (!t.checked && wasChecked) {
    creationStore.toggleProficiency(groupId, optionIndex, maxChoose)
  }
}

function canIncrement(key: AbilityScoreKey): boolean {
  const cur = draft.value.abilityScores[key]
  if (cur >= 15) return false
  const nextScores = { ...draft.value.abilityScores, [key]: cur + 1 }
  return totalPointCost(nextScores) <= POINT_BUY_BUDGET
}

function canDecrement(key: AbilityScoreKey): boolean {
  return draft.value.abilityScores[key] > 8
}
</script>

<template>
  <div class="wiz" aria-label="Создание персонажа">
    <div class="wiz__top">
      <button type="button" class="wiz__back-all" @click="emit('cancel')">
        <span class="wiz__back-arrow" aria-hidden="true">←</span>
        Все персонажи
      </button>

      <div class="wiz__stepper-block">
        <ol class="wiz__stepper" aria-label="Шаги создания">
          <li
            v-for="s in wizardSteps"
            :key="s.key"
            class="wiz__step"
            :class="{
              'wiz__step--active': currentStep === s.n,
              'wiz__step--done': currentStep > s.n,
              'wiz__step--todo': currentStep < s.n,
            }"
            :aria-current="currentStep === s.n ? 'step' : undefined"
          >
            <span class="wiz__step-circle" aria-hidden="true">
              <svg
                v-if="currentStep > s.n"
                class="wiz__step-check"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span v-else class="wiz__step-num">{{ s.n }}</span>
            </span>
            <span class="wiz__step-label">{{ s.label }}</span>
          </li>
        </ol>

        <div class="wiz__nav-row">
          <button v-if="currentStep > 1" type="button" class="wiz__nav-prev" :disabled="primaryBusy" @click="goBack">
            <span aria-hidden="true">←</span>
            Назад
          </button>
          <button
            type="button"
            class="wiz__nav-next"
            :class="{ 'wiz__nav-next--push': currentStep === 1 }"
            :disabled="primaryBusy"
            :aria-label="currentStepKey === 'review' ? 'Создать персонажа' : 'Дальше'"
            @click="onPrimaryAction"
          >
            {{ primaryLabel() }}
            <span v-if="currentStepKey !== 'review'" class="wiz__nav-next-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>

    <div class="wiz__body">
      <p v-if="lastError" class="wiz__err wiz__api-err" role="alert">{{ lastError }}</p>

      <template v-if="currentStepKey === 'basic'">
        <h1 class="wiz__h1">Основная информация</h1>

        <label class="wiz__field">
          <span class="wiz__lbl">Имя</span>
          <input
            v-model="draft.name"
            type="text"
            class="wiz__input"
            autocomplete="off"
            @input="step1Error = ''"
          />
        </label>
        <p v-if="step1Error" class="wiz__err">{{ step1Error }}</p>

        <label class="wiz__field">
          <span class="wiz__lbl">Предыстория</span>
          <textarea v-model="draft.backstory" class="wiz__textarea" rows="6" />
        </label>

        <label class="wiz__field wiz__field--narrow">
          <span class="wiz__lbl">Уровень</span>
          <input v-model="draft.level" type="text" inputmode="numeric" class="wiz__input wiz__input--sm" />
        </label>

        <h2 class="wiz__h2">Аватар</h2>
        <div class="wiz__avatar-block">
          <div class="wiz__avatar-preview">
            <img v-if="avatarObjectUrl" :src="avatarObjectUrl" alt="" class="wiz__avatar-img" />
            <div v-else class="wiz__avatar-placeholder" aria-hidden="true" />
          </div>
          <div class="wiz__avatar-actions">
            <button type="button" class="wiz__avatar-btn" @click="promptAvatarUpload">Выбрать изображение</button>
            <button
              v-if="draft.pendingAvatarFile"
              type="button"
              class="wiz__avatar-btn wiz__avatar-btn--muted"
              @click="clearAvatar"
            >
              Убрать
            </button>
            <p class="wiz__avatar-hint">Файл загрузится на сервер после создания персонажа.</p>
          </div>
        </div>
        <input
          ref="avatarFileInput"
          type="file"
          accept="image/*"
          class="wiz__file-input"
          tabindex="-1"
          aria-hidden="true"
          @change="onAvatarSelected"
        />
        <p v-if="step1AvatarError" class="wiz__err">{{ step1AvatarError }}</p>

        <h2 class="wiz__h2">Раса и класс</h2>
        <div class="wiz__row2">
          <label class="wiz__field">
            <span class="wiz__lbl">Раса</span>
            <select v-model="draft.raceId" class="wiz__select">
              <option v-for="r in raceOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
          </label>
          <label class="wiz__field">
            <span class="wiz__lbl">Класс</span>
            <select v-model="draft.classId" class="wiz__select">
              <option v-for="c in classOptions" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
          </label>
        </div>
      </template>

      <template v-else-if="currentStepKey === 'stats'">
        <h1 class="wiz__h1">Характеристики (Доступно {{ remainingPoints }}/{{ POINT_BUY_BUDGET }})</h1>
        <p v-if="step2Error" class="wiz__err">{{ step2Error }}</p>
        <p class="wiz__hint">
          Распределите {{ POINT_BUY_BUDGET }} очков (PHB). Стоимость значений от 8 до 15 — стандартная таблица.
        </p>

        <ul class="wiz__stats" role="list">
          <li v-for="key in ABILITY_SCORE_KEYS" :key="key" class="wiz__stat-row">
            <span class="wiz__stat-name">{{ ABILITY_LABELS[key] }}</span>
            <div class="wiz__stat-ctrl">
              <button
                type="button"
                class="wiz__stat-btn"
                :disabled="!canDecrement(key)"
                :aria-label="`Уменьшить ${ABILITY_LABELS[key]}`"
                @click="adjustAbility(key, -1)"
              >
                −
              </button>
              <span class="wiz__stat-val" aria-live="polite">{{ draft.abilityScores[key] }}</span>
              <button
                type="button"
                class="wiz__stat-btn"
                :disabled="!canIncrement(key)"
                :aria-label="`Увеличить ${ABILITY_LABELS[key]}`"
                @click="adjustAbility(key, 1)"
              >
                +
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else-if="currentStepKey === 'asi'">
        <h1 class="wiz__h1">
          Улучшения характеристик ({{ creationStore.asiPointsSpent() }}/{{ totalAsiPoints }})
        </h1>
        <p v-if="stepAsiError" class="wiz__err">{{ stepAsiError }}</p>
        <p class="wiz__hint">Распределите очки ASI: +1 или +2 к характеристикам (максимум +2 на одну).</p>
        <ul class="wiz__stats" role="list">
          <li v-for="opt in ASI_STAT_OPTIONS" :key="opt.apiIndex" class="wiz__stat-row">
            <span class="wiz__stat-name">{{ opt.label }}</span>
            <div class="wiz__stat-ctrl">
              <button
                type="button"
                class="wiz__stat-btn"
                :disabled="asiPointsForStat(opt.apiIndex) <= 0"
                @click="adjustAsi(opt.apiIndex, -1)"
              >
                −
              </button>
              <span class="wiz__stat-val">{{ asiPointsForStat(opt.apiIndex) }}</span>
              <button
                type="button"
                class="wiz__stat-btn"
                :disabled="
                  asiPointsForStat(opt.apiIndex) >= 2 ||
                  creationStore.asiPointsSpent() >= totalAsiPoints
                "
                @click="adjustAsi(opt.apiIndex, 1)"
              >
                +
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else-if="currentStepKey === 'prof'">
        <template v-if="hasSession && proficiencyGroups.length">
          <h1 class="wiz__h1">Владения</h1>
          <p v-if="step3Error" class="wiz__err">{{ step3Error }}</p>
          <section v-for="group in proficiencyGroups" :key="group.id" class="wiz__prof-group">
            <h2 class="wiz__h2">{{ group.desc }} ({{ proficiencyGroupCount(group.id) }}/{{ group.choose }})</h2>
            <ul class="wiz__skill-list" role="list">
              <li v-for="opt in group.options" :key="opt.index" class="wiz__skill-li">
                <label class="wiz__skill-label">
                  <input
                    type="checkbox"
                    class="wiz__skill-check"
                    :checked="isProficiencyChecked(group.id, opt.index)"
                    :disabled="isProficiencyCheckboxDisabled(group.id, opt.index, group.choose)"
                    @change="onProficiencyChange(group.id, opt.index, group.choose, $event)"
                  />
                  <span class="wiz__skill-text">{{ opt.name }}</span>
                </label>
              </li>
            </ul>
          </section>
        </template>
        <template v-else>
          <h1 class="wiz__h1">Навыки {{ selectedSkillCount }}/{{ SKILL_CHOICE_COUNT }}</h1>
          <p v-if="step3Error" class="wiz__err">{{ step3Error }}</p>
          <p class="wiz__hint">Отметьте {{ SKILL_CHOICE_COUNT }} навыка владения (модификатор считается от ваших характеристик).</p>
          <ul class="wiz__skill-list" role="list">
            <li v-for="opt in CREATOR_SKILL_OPTIONS" :key="opt.id" class="wiz__skill-li">
              <label class="wiz__skill-label">
                <input
                  type="checkbox"
                  class="wiz__skill-check"
                  :checked="draft.proficientSkillIds.includes(opt.id)"
                  :disabled="isSkillCheckboxDisabled(opt.id)"
                  @change="onSkillCheckboxChange(opt.id, $event)"
                />
                <span class="wiz__skill-text">{{ opt.label }}</span>
                <span class="wiz__skill-meta">{{ ABILITY_LABELS[opt.ability] }}</span>
              </label>
            </li>
          </ul>
        </template>
      </template>

      <template v-else-if="currentStepKey === 'equip'">
        <h1 class="wiz__h1">Снаряжение</h1>
        <p class="wiz__muted">Раздел появится в следующей итерации.</p>
      </template>

      <template v-else-if="currentStepKey === 'review'">
        <div class="wiz__prev">
          <h1 class="wiz__h1">Итог</h1>
          <div v-if="avatarObjectUrl" class="wiz__prev-portrait-wrap">
            <img :src="avatarObjectUrl" alt="" class="wiz__prev-portrait" />
          </div>
          <h2 class="wiz__prev-hero-name">{{ draft.name.trim() || previewSheet.displayTitle }}</h2>
          <p v-if="draft.name.trim()" class="wiz__prev-hero-meta">{{ previewSheet.displayTitle }}</p>

          <div class="wiz__prev-stats">
            <div class="wiz__prev-stat">
              <span class="wiz__prev-stat-val">{{ previewSheet.hits }}</span>
              <span class="wiz__prev-stat-lbl">Хиты</span>
            </div>
            <div class="wiz__prev-stat">
              <span class="wiz__prev-stat-val">{{ previewSheet.ac }}</span>
              <span class="wiz__prev-stat-lbl">КД</span>
            </div>
            <div class="wiz__prev-stat">
              <span class="wiz__prev-stat-val">{{ previewSheet.speed }}</span>
              <span class="wiz__prev-stat-lbl">Скорость</span>
            </div>
          </div>

          <h2 class="wiz__prev-h2">Навыки и характеристики</h2>
          <div class="wiz__prev-abilities" aria-label="Характеристики и навыки">
            <div v-for="col in previewSheet.abilities" :key="col.id" class="wiz__prev-ability-col">
              <div class="wiz__prev-ability-head" :style="{ background: col.headerBg }">
                <span class="wiz__prev-ability-name">{{ col.label }}</span>
                <span class="wiz__prev-ability-mod">{{ col.modifier }} ({{ col.score }})</span>
              </div>
              <ul class="wiz__prev-ability-skills">
                <li
                  v-for="(sk, j) in col.skills"
                  :key="j"
                  class="wiz__prev-skill-row"
                  :style="{ background: col.skillCellBg }"
                >
                  <span class="wiz__prev-skill-name">{{ sk.name }}</span>
                  <span class="wiz__prev-skill-bonus">{{ sk.bonus }}</span>
                </li>
              </ul>
            </div>
          </div>

          <h2 class="wiz__prev-h2">История</h2>
          <p class="wiz__prev-history">{{ previewSheet.history }}</p>

          <p v-if="avatarUploadError" class="wiz__err" role="alert">{{ avatarUploadError }}</p>

          <p v-if="!hasSession" class="wiz__muted wiz__prev-foot">
            Персонаж будет добавлен в список только локально (нет связи с API).
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wiz {
  --wiz-bg: #121212;
  --wiz-panel: #1a1a1a;
  --wiz-muted: #a3a3a3;
  --wiz-text: #fafafa;
  --wiz-accent: #f97316;
  --wiz-line: rgba(255, 255, 255, 0.08);

  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  color: var(--wiz-text);
}

.wiz__top {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.wiz__back-all {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--wiz-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s;
}

.wiz__back-all:hover {
  color: #fff;
}

.wiz__back-arrow {
  font-size: 16px;
  line-height: 1;
}

.wiz__stepper-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.wiz__stepper {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  width: 100%;
  flex-wrap: nowrap;
  justify-content: space-between;
}

.wiz__step {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.wiz__step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 700;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.wiz__step-num {
  line-height: 1;
}

.wiz__step-check {
  color: #fff;
}

.wiz__step--todo .wiz__step-circle {
  color: rgba(255, 255, 255, 0.55);
}

.wiz__step--active .wiz__step-circle {
  background: var(--wiz-accent);
  border-color: var(--wiz-accent);
  color: #fff;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.28);
}

.wiz__step--done .wiz__step-circle {
  background: rgba(249, 115, 22, 0.85);
  border-color: rgba(249, 115, 22, 0.95);
  color: #fff;
}

.wiz__step-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--wiz-muted);
  text-align: center;
  line-height: 1.25;
}

.wiz__step--active .wiz__step-label {
  color: #fff;
  box-shadow: 0 2px 0 0 var(--wiz-accent);
  padding-bottom: 2px;
}

.wiz__step--done .wiz__step-label {
  color: rgba(249, 115, 22, 0.95);
}

.wiz__nav-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wiz__nav-prev {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 999px;
  border: none;
  background: #2a2a2a;
  color: #fafafa;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wiz__nav-prev:hover {
  background: #333;
}

.wiz__nav-next {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 999px;
  border: none;
  background: #f5f5f5;
  color: #171717;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}

.wiz__nav-next:hover {
  background: #fff;
}

.wiz__nav-next:active {
  transform: scale(0.99);
}

.wiz__nav-next--push {
  margin-left: auto;
}

.wiz__nav-next-arrow {
  font-size: 15px;
}

.wiz__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.wiz__h1 {
  margin: 0 0 20px;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.wiz__h2 {
  margin: 24px 0 14px;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.wiz__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.wiz__field--narrow {
  max-width: 120px;
}

.wiz__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.wiz__avatar-block {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
}

.wiz__avatar-preview {
  width: 96px;
  height: 96px;
  border-radius: 14px;
  overflow: hidden;
  background: #0a0a0a;
  border: 1px solid var(--wiz-line);
  flex-shrink: 0;
}

.wiz__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wiz__avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #1e3a5f, #0f172a);
}

.wiz__avatar-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.wiz__avatar-btn {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--wiz-line);
  background: var(--wiz-panel);
  color: var(--wiz-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.wiz__avatar-btn:hover {
  background: #242424;
  border-color: rgba(255, 255, 255, 0.14);
}

.wiz__avatar-btn--muted {
  color: var(--wiz-muted);
}

.wiz__avatar-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--wiz-muted);
  max-width: 280px;
}

.wiz__lbl {
  font-size: 13px;
  font-weight: 500;
  color: var(--wiz-muted);
}

.wiz__input,
.wiz__textarea,
.wiz__select {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--wiz-line);
  background: var(--wiz-panel);
  color: var(--wiz-text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.wiz__input:focus,
.wiz__textarea:focus,
.wiz__select:focus {
  border-color: rgba(249, 115, 22, 0.45);
}

.wiz__input--sm {
  max-width: 100px;
}

.wiz__textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.5;
}

.wiz__select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.wiz__row2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 520px) {
  .wiz__row2 {
    grid-template-columns: 1fr 1fr;
  }
}

.wiz__err {
  margin: -8px 0 12px;
  font-size: 13px;
  color: #fb7185;
}

.wiz__prof-group {
  margin-bottom: 1.25rem;
}

.wiz__api-err {
  margin-bottom: 12px;
}

.wiz__hint {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wiz-muted);
}

.wiz__muted {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--wiz-muted);
}

.wiz__stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wiz__stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
}

.wiz__stat-name {
  font-size: 15px;
  font-weight: 500;
}

.wiz__stat-ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wiz__stat-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  color: #171717;
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.05s;
}

.wiz__stat-btn:hover:not(:disabled) {
  background: #fff;
}

.wiz__stat-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.wiz__stat-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wiz__stat-val {
  min-width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  border: 1px solid var(--wiz-line);
  font-size: 17px;
  font-weight: 700;
}

.wiz__skill-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wiz__skill-li {
  margin: 0;
}

.wiz__skill-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--wiz-line);
  background: var(--wiz-panel);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.wiz__skill-label:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.wiz__skill-label:has(.wiz__skill-check:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

.wiz__skill-label:has(.wiz__skill-check:disabled):hover {
  border-color: var(--wiz-line);
  background: var(--wiz-panel);
}

.wiz__skill-check {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  margin: 0;
  accent-color: var(--wiz-accent);
  cursor: pointer;
}

.wiz__skill-check:disabled {
  cursor: not-allowed;
}

.wiz__skill-text {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
}

.wiz__skill-meta {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--wiz-muted);
}

/* Шаг «Итог»: превью листа (аналог cc__* в CampaignCharactersSection) */
.wiz__prev {
  min-width: 0;
}

.wiz__prev-portrait-wrap {
  width: 120px;
  height: 120px;
  border-radius: 14px;
  overflow: hidden;
  background: #0a0a0a;
  border: 1px solid var(--wiz-line);
  margin-bottom: 16px;
}

.wiz__prev-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wiz__prev-hero-name {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.25;
}

.wiz__prev-hero-meta {
  margin: 0 0 18px;
  font-size: 14px;
  color: var(--wiz-muted);
}

.wiz__prev-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
}

.wiz__prev-stat {
  flex: 1;
  min-height: 56px;
  min-width: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: #262626;
  border: 1px solid var(--wiz-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.wiz__prev-stat-val {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.wiz__prev-stat-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--wiz-muted);
}

.wiz__prev-h2 {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 600;
}

.wiz__prev-abilities {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 22px;
  min-width: 0;
}

@media (min-width: 520px) {
  .wiz__prev-abilities {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 720px) {
  .wiz__prev-abilities {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .wiz__prev-abilities {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .wiz__prev-abilities {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.wiz__prev-ability-col {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--wiz-line);
  min-width: 0;
}

.wiz__prev-ability-head {
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wiz__prev-ability-name {
  font-size: 13px;
  font-weight: 600;
}

.wiz__prev-ability-mod {
  font-size: 12px;
  opacity: 0.9;
}

.wiz__prev-ability-skills {
  list-style: none;
  margin: 0;
  padding: 0;
}

.wiz__prev-skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  font-size: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.2);
}

.wiz__prev-skill-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.88);
}

.wiz__prev-skill-bonus {
  font-weight: 600;
  opacity: 0.95;
  white-space: nowrap;
}

.wiz__prev-history {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--wiz-muted);
  white-space: pre-line;
}

.wiz__prev-foot {
  margin: 0;
}

@media (min-width: 520px) {
  .wiz__prev-stats {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .wiz__prev-stat {
    min-width: 100px;
  }
}
</style>
