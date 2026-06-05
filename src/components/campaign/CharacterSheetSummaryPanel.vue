<script setup lang="ts">
import { computed } from 'vue'

import { resolveCharacterPortraitUrl, type CharacterSheet, type QuestTag } from '@/types/character-campaign'

const props = defineProps<{
  sheet: CharacterSheet
}>()

const TAG_ROW_MAX = 5

const tagRow = computed(() => {
  const tags = props.sheet.questTags
  const visible = tags.slice(0, TAG_ROW_MAX)
  const more = Math.max(0, tags.length - visible.length)
  return { visible, more }
})

function pillClass(t: QuestTag): string {
  if (t.variant === 'orange' || t.variant === 'brown') return 'cssum__pill cssum__pill--loc'
  return 'cssum__pill cssum__pill--quest'
}
</script>

<template>
  <div class="cssum" aria-label="Лист персонажа">
    <div class="cssum__body">
      <header id="cssum-main" class="cssum__head" tabindex="-1">
        <div class="cssum__head-text">
          <h1 class="cssum__name">{{ sheet.displayTitle }}</h1>
          <p v-if="sheet.listSubtitle" class="cssum__subtitle">{{ sheet.listSubtitle }}</p>
          <div class="cssum__pills">
            <span v-for="(t, i) in tagRow.visible" :key="i" :class="pillClass(t)">{{ t.label }}</span>
            <span v-if="tagRow.more > 0" class="cssum__pill cssum__pill--more">+{{ tagRow.more }}</span>
          </div>
        </div>
      </header>

      <div class="cssum__hero">
        <div
          class="cssum__portrait"
          :class="{ 'cssum__portrait--empty': !resolveCharacterPortraitUrl(sheet.portraitUrl) }"
        >
          <img
            v-if="resolveCharacterPortraitUrl(sheet.portraitUrl)"
            :src="resolveCharacterPortraitUrl(sheet.portraitUrl)!"
            alt=""
            class="cssum__portrait-img"
          />
        </div>

        <div class="cssum__hero-stats">
          <div class="cssum__stat">
            <span class="cssum__stat-val">{{ sheet.hits }}</span>
            <span class="cssum__stat-lbl">Хиты</span>
          </div>
          <div class="cssum__stat">
            <span class="cssum__stat-val">{{ sheet.ac }}</span>
            <span class="cssum__stat-lbl">КД</span>
          </div>
          <div class="cssum__stat">
            <span class="cssum__stat-val">{{ sheet.speed }}</span>
            <span class="cssum__stat-lbl">Скорость</span>
          </div>
        </div>
      </div>

      <h2 id="cssum-skills" class="cssum__h2" tabindex="-1">Навыки и характеристики</h2>
      <div class="cssum__abilities" aria-label="Характеристики и навыки">
        <div v-for="col in sheet.abilities" :key="col.id" class="cssum__ability-col">
          <div class="cssum__ability-head" :style="{ background: col.headerBg }">
            <span class="cssum__ability-name">{{ col.label }}</span>
            <span class="cssum__ability-mod">{{ col.modifier }} ({{ col.score }})</span>
          </div>
          <ul class="cssum__ability-skills">
            <li
              v-for="(sk, j) in col.skills"
              :key="j"
              class="cssum__skill-row"
              :style="{ background: col.skillCellBg }"
            >
              <span class="cssum__skill-name">{{ sk.name }}</span>
              <span class="cssum__skill-bonus">{{ sk.bonus }}</span>
            </li>
          </ul>
        </div>
      </div>

      <h2 id="cssum-history" class="cssum__h2" tabindex="-1">История</h2>
      <p class="cssum__history">{{ sheet.history }}</p>
    </div>
  </div>
</template>

<style scoped>
.cssum {
  --cssum-muted: #a3a3a3;
  --cssum-text: #fafafa;
  --cssum-line: rgba(255, 255, 255, 0.08);

  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  color: var(--cssum-text);
}

.cssum__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.cssum__head {
  margin-bottom: 22px;
}

.cssum__head-text {
  min-width: 0;
  flex: 1;
}

.cssum__name {
  margin: 0 0 10px;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.cssum__subtitle {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--cssum-muted);
}

.cssum__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cssum__pill {
  display: inline-block;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cssum__pill--loc {
  color: #ea580c;
  background: #fff2e8;
  border: 1.5px solid #fb923c;
}

.cssum__pill--quest {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1.5px solid #60a5fa;
}

.cssum__pill--more {
  color: #d4d4d4;
  background: rgba(115, 115, 115, 0.25);
  border: 1px solid rgba(115, 115, 115, 0.4);
}

.cssum__hero {
  display: grid;
  grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  margin-bottom: 28px;
  min-width: 0;
}

@media (max-width: 560px) {
  .cssum__hero {
    grid-template-columns: 1fr;
  }
}

.cssum__portrait {
  border-radius: 14px;
  overflow: hidden;
  background: #0a0a0a;
  border: 1px solid var(--cssum-line);
  aspect-ratio: 1;
  max-height: 220px;
}

.cssum__portrait--empty {
  background: #1f1f1f;
}

.cssum__portrait-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cssum__hero-stats {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  align-content: flex-start;
}

.cssum__stat {
  flex: 1;
  min-width: 88px;
  min-height: 72px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #262626;
  border: 1px solid var(--cssum-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.cssum__stat-val {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cssum__stat-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--cssum-muted);
}

.cssum__h2 {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 600;
}

.cssum__abilities {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 28px;
  min-width: 0;
}

@media (min-width: 520px) {
  .cssum__abilities {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 720px) {
  .cssum__abilities {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .cssum__abilities {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .cssum__abilities {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.cssum__ability-col {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--cssum-line);
  min-width: 0;
}

.cssum__ability-head {
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cssum__ability-name {
  font-size: 13px;
  font-weight: 600;
}

.cssum__ability-mod {
  font-size: 12px;
  opacity: 0.9;
}

.cssum__ability-skills {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cssum__skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  font-size: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.2);
}

.cssum__skill-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.88);
}

.cssum__skill-bonus {
  font-weight: 600;
  opacity: 0.95;
  white-space: nowrap;
}

.cssum__history {
  margin: 0 0 24px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--cssum-muted);
  white-space: pre-line;
}
</style>
