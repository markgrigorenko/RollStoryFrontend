import gleffPortraitUrl from '@/assets/characters/character-portrait-gleff.png'
import torrinPortraitUrl from '@/assets/characters/character-portrait-torrin.png'
import durotanPortraitUrl from '@/assets/characters/character-portrait-durotan.png'

/** Портрет по умолчанию для демо-персонажа Глеффа (bootstrap / офлайн-демо). */
export const DEFAULT_CHARACTER_PORTRAIT_URL = gleffPortraitUrl

/** Портреты трёх демо-персонажей bootstrap по точному имени. */
export const DEMO_CHARACTER_PORTRAIT_BY_NAME: Record<string, string> = {
  "Глефф Драконорожденный из клана Велес'Раал": DEFAULT_CHARACTER_PORTRAIT_URL,
  'Торрин Дубощит': torrinPortraitUrl,
  Дуротан: durotanPortraitUrl,
}

export function getDemoCharacterPortraitAssetUrl(name: string): string | null {
  return DEMO_CHARACTER_PORTRAIT_BY_NAME[name.trim()] ?? null
}

/** Портрет для листа: avatarLink с API, иначе демо по имени, иначе null (без заглушки). */
export function portraitUrlForCharacterName(name: string, avatarLink?: string | null): string | null {
  const fromApi = avatarLink?.trim()
  if (fromApi) return fromApi
  return getDemoCharacterPortraitAssetUrl(name)
}

export function resolveCharacterPortraitUrl(portraitUrl?: string | null): string | null {
  const trimmed = portraitUrl?.trim()
  return trimmed || null
}

export interface CampaignCharacterListItem {
  id: string
  /** Короткое имя в списке слева */
  listName: string
}

export type QuestTagVariant = 'orange' | 'brown' | 'blue' | 'sky'

export interface QuestTag {
  label: string
  variant: QuestTagVariant
}

export interface SkillRow {
  name: string
  /** например "+1", "0", "+5" */
  bonus: string
}

export interface AbilityColumn {
  id: string
  label: string
  modifier: string
  score: number
  headerBg: string
  skillCellBg: string
  skills: SkillRow[]
}

export interface CharacterSheet {
  id: string
  /** последний сегмент крошек (локация и т.п.) */
  breadcrumbTail: string
  displayTitle: string
  /** Подпись под именем в карточке списка (класс и т.п.) */
  listSubtitle?: string
  /** Явная подпись для оранжевого чипа локации в карточке (если не задано — берётся оранжевый questTag или breadcrumbTail) */
  locationLabel?: string
  questTags: QuestTag[]
  portraitUrl: string | null
  hits: number
  ac: number
  speed: number
  abilities: AbilityColumn[]
  history: string
}

export const DEMO_CHARACTER_SHEETS: Record<'gleff' | 'torrin' | 'durotan', CharacterSheet> = {
  gleff: {
    id: 'gleff',
    breadcrumbTail: 'Замок',
    displayTitle: "Глефф Драконорожденный из клана Велес'Раал",
    listSubtitle: 'Рыцарь',
    locationLabel: 'г. Лирия',
    questTags: [
      { label: 'Город Лихолесье', variant: 'orange' },
      { label: 'Замок Доуида', variant: 'brown' },
      { label: 'Помощь бедняку Джо', variant: 'blue' },
      { label: 'Еще какой-то длинный квест…', variant: 'sky' },
    ],
    portraitUrl: DEFAULT_CHARACTER_PORTRAIT_URL,
    hits: 23,
    ac: 16,
    speed: 30,
    abilities: [
      {
        id: 'str',
        label: 'Сила',
        modifier: '+1',
        score: 12,
        headerBg: 'rgba(127, 29, 29, 0.55)',
        skillCellBg: 'rgba(127, 29, 29, 0.35)',
        skills: [{ name: 'Атлетика', bonus: '+1' }],
      },
      {
        id: 'dex',
        label: 'Ловкость',
        modifier: '+2',
        score: 14,
        headerBg: 'rgba(22, 101, 52, 0.55)',
        skillCellBg: 'rgba(22, 101, 52, 0.35)',
        skills: [
          { name: 'Акробатика', bonus: '+2' },
          { name: 'Ловкость рук', bonus: '+2' },
          { name: 'Скрытность', bonus: '0' },
        ],
      },
      {
        id: 'con',
        label: 'Тело',
        modifier: '+1',
        score: 12,
        headerBg: 'rgba(154, 52, 18, 0.5)',
        skillCellBg: 'rgba(154, 52, 18, 0.32)',
        skills: [],
      },
      {
        id: 'int',
        label: 'Интеллект',
        modifier: '+0',
        score: 10,
        headerBg: 'rgba(30, 58, 138, 0.55)',
        skillCellBg: 'rgba(30, 58, 138, 0.35)',
        skills: [
          { name: 'Анализ', bonus: '+0' },
          { name: 'История', bonus: '+0' },
          { name: 'Магия', bonus: '+0' },
          { name: 'Природа', bonus: '+0' },
          { name: 'Религия', bonus: '+0' },
        ],
      },
      {
        id: 'wis',
        label: 'Мудрость',
        modifier: '+3',
        score: 16,
        headerBg: 'rgba(88, 28, 135, 0.5)',
        skillCellBg: 'rgba(88, 28, 135, 0.32)',
        skills: [
          { name: 'Внимание', bonus: '+5' },
          { name: 'Выживание', bonus: '+3' },
          { name: 'Медицина', bonus: '+3' },
          { name: 'Проницательность', bonus: '+3' },
          { name: 'Уход за животными', bonus: '+3' },
        ],
      },
      {
        id: 'cha',
        label: 'Харизма',
        modifier: '+1',
        score: 12,
        headerBg: 'rgba(113, 63, 18, 0.5)',
        skillCellBg: 'rgba(113, 63, 18, 0.32)',
        skills: [
          { name: 'Выступление', bonus: '+1' },
          { name: 'Запугивание', bonus: '+1' },
          { name: 'Обман', bonus: '+1' },
          { name: 'Убеждение', bonus: '+1' },
        ],
      },
    ],
    history: `Глефф вырос в стенах клана Велес'Раал — не как наследник линии, а как тот, кого терпели за упрямство и за то, что слишком громко говорил правду. Его учили читать знаки неба и крови, но он чаще читал людей: где ложь держится за смехом, где страх прячется за криком.

Когда клан решил «забыть» старые долги, Глефф оказался между молотом традиции и наковальней совести. Он ушёл не из трусости — из того, что не смог больше складывать слова так, чтобы они не резали горло.

Теперь он ищет дорогу, где честь не противоречит выживанию. Или хотя бы где можно спать, не прикидывая, кто ночью придёт за твоей шеей.`,
  },
  torrin: {
    id: 'torrin',
    breadcrumbTail: 'Лагерь',
    displayTitle: 'Торрин Дубощит, страж границы',
    listSubtitle: 'Воин',
    questTags: [{ label: 'Караван на север', variant: 'blue' }],
    portraitUrl: torrinPortraitUrl,
    hits: 18,
    ac: 18,
    speed: 25,
    abilities: [
      {
        id: 'str',
        label: 'Сила',
        modifier: '+3',
        score: 16,
        headerBg: 'rgba(127, 29, 29, 0.55)',
        skillCellBg: 'rgba(127, 29, 29, 0.35)',
        skills: [{ name: 'Атлетика', bonus: '+5' }],
      },
      {
        id: 'dex',
        label: 'Ловкость',
        modifier: '+0',
        score: 10,
        headerBg: 'rgba(22, 101, 52, 0.55)',
        skillCellBg: 'rgba(22, 101, 52, 0.35)',
        skills: [{ name: 'Скрытность', bonus: '+0' }],
      },
      {
        id: 'con',
        label: 'Тело',
        modifier: '+2',
        score: 14,
        headerBg: 'rgba(154, 52, 18, 0.5)',
        skillCellBg: 'rgba(154, 52, 18, 0.32)',
        skills: [],
      },
      {
        id: 'int',
        label: 'Интеллект',
        modifier: '-1',
        score: 8,
        headerBg: 'rgba(30, 58, 138, 0.55)',
        skillCellBg: 'rgba(30, 58, 138, 0.35)',
        skills: [{ name: 'Выживание', bonus: '+1' }],
      },
      {
        id: 'wis',
        label: 'Мудрость',
        modifier: '+1',
        score: 12,
        headerBg: 'rgba(88, 28, 135, 0.5)',
        skillCellBg: 'rgba(88, 28, 135, 0.32)',
        skills: [{ name: 'Внимание', bonus: '+3' }],
      },
      {
        id: 'cha',
        label: 'Харизма',
        modifier: '+0',
        score: 10,
        headerBg: 'rgba(113, 63, 18, 0.5)',
        skillCellBg: 'rgba(113, 63, 18, 0.32)',
        skills: [{ name: 'Убеждение', bonus: '+0' }],
      },
    ],
    history: 'Торрин служил у дубовых ворот десять сезонов. Записей о нём мало — он предпочитал, чтобы говорили щиты.',
  },
  durotan: {
    id: 'durotan',
    breadcrumbTail: 'Дорога',
    displayTitle: 'Дуротан, следопыт долин',
    listSubtitle: 'Следопыт',
    questTags: [],
    portraitUrl: durotanPortraitUrl,
    hits: 14,
    ac: 14,
    speed: 35,
    abilities: [
      {
        id: 'str',
        label: 'Сила',
        modifier: '+0',
        score: 10,
        headerBg: 'rgba(127, 29, 29, 0.55)',
        skillCellBg: 'rgba(127, 29, 29, 0.35)',
        skills: [],
      },
      {
        id: 'dex',
        label: 'Ловкость',
        modifier: '+4',
        score: 18,
        headerBg: 'rgba(22, 101, 52, 0.55)',
        skillCellBg: 'rgba(22, 101, 52, 0.35)',
        skills: [
          { name: 'Акробатика', bonus: '+6' },
          { name: 'Скрытность', bonus: '+8' },
        ],
      },
      {
        id: 'con',
        label: 'Тело',
        modifier: '+1',
        score: 12,
        headerBg: 'rgba(154, 52, 18, 0.5)',
        skillCellBg: 'rgba(154, 52, 18, 0.32)',
        skills: [],
      },
      {
        id: 'int',
        label: 'Интеллект',
        modifier: '+0',
        score: 10,
        headerBg: 'rgba(30, 58, 138, 0.55)',
        skillCellBg: 'rgba(30, 58, 138, 0.35)',
        skills: [{ name: 'Природа', bonus: '+4' }],
      },
      {
        id: 'wis',
        label: 'Мудрость',
        modifier: '+2',
        score: 14,
        headerBg: 'rgba(88, 28, 135, 0.5)',
        skillCellBg: 'rgba(88, 28, 135, 0.32)',
        skills: [
          { name: 'Внимание', bonus: '+4' },
          { name: 'Выживание', bonus: '+6' },
        ],
      },
      {
        id: 'cha',
        label: 'Харизма',
        modifier: '-1',
        score: 8,
        headerBg: 'rgba(113, 63, 18, 0.5)',
        skillCellBg: 'rgba(113, 63, 18, 0.32)',
        skills: [],
      },
    ],
    history: 'Дуротан знает тропы лучше птиц — или так говорят те, кто с ним не спорит.',
  },
}

export const DEMO_CHARACTER_LIST: CampaignCharacterListItem[] = [
  { id: 'gleff', listName: 'Глефф Драконорожденный рожденный' },
  { id: 'torrin', listName: 'Торрин Дубощит' },
  { id: 'durotan', listName: 'Дуротан' },
]

/** Выбор в мастере создания (шаг 1) */
export interface PickListItem {
  id: string
  label: string
}

export const DEMO_RACES: PickListItem[] = [
  { id: 'dwarf', label: 'Дварф' },
  { id: 'elf', label: 'Эльф' },
  { id: 'halfling', label: 'Халфлинг' },
  { id: 'human', label: 'Человек' },
  { id: 'dragonborn', label: 'Драконорожденный' },
  { id: 'gnome', label: 'Гном' },
  { id: 'half-elf', label: 'Полуэльф' },
  { id: 'half-orc', label: 'Полуорк' },
  { id: 'tiefling', label: 'Тифлинг' },
]

export const DEMO_CLASSES: PickListItem[] = [
  { id: 'barbarian', label: 'Варвар' },
  { id: 'bard', label: 'Бард' },
  { id: 'cleric', label: 'Жрец' },
  { id: 'druid', label: 'Друид' },
  { id: 'fighter', label: 'Воин' },
  { id: 'monk', label: 'Монах' },
  { id: 'paladin', label: 'Паладин' },
  { id: 'ranger', label: 'Следопыт' },
  { id: 'rogue', label: 'Плут' },
  { id: 'sorcerer', label: 'Чародей' },
  { id: 'warlock', label: 'Колдун' },
  { id: 'wizard', label: 'Волшебник' },
]

/** Ключи характеристик (point-buy и лист) */
export type AbilityScoreKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export const ABILITY_SCORE_KEYS: AbilityScoreKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export type CharacterAbilityScores = Record<AbilityScoreKey, number>

/** Бюджет point-buy PHB (27 очков) */
export const POINT_BUY_BUDGET = 27

/** Стоимость в очках характеристики относительно базы 8 (накопительно до этого значения) */
const SCORE_POINT_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

export function pointCostForScore(score: number): number {
  const s = Math.round(score)
  return SCORE_POINT_COST[s] ?? 0
}

export function totalPointCost(scores: CharacterAbilityScores): number {
  return ABILITY_SCORE_KEYS.reduce((sum, k) => sum + pointCostForScore(scores[k]), 0)
}

export function remainingPointsFromScores(scores: CharacterAbilityScores): number {
  return POINT_BUY_BUDGET - totalPointCost(scores)
}

export function formatAbilityModifier(score: number): string {
  const m = Math.floor((score - 10) / 2)
  if (m >= 0) return `+${m}`
  return String(m)
}

/** Бонус мастерства PHB по уровню персонажа */
export function proficiencyBonus(characterLevel: number): number {
  const l = Math.min(20, Math.max(1, Math.floor(characterLevel)))
  if (l <= 4) return 2
  if (l <= 8) return 3
  if (l <= 12) return 4
  if (l <= 16) return 5
  return 6
}

/** Целое с знаком для навыков (+0, -1, +5) */
export function formatSignedBonus(total: number): string {
  if (total >= 0) return `+${total}`
  return String(total)
}

export function defaultAbilityScores(): CharacterAbilityScores {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
}

/** Сколько владений навыками выбирается на шаге мастера (демо, как в макете 0/2) */
export const SKILL_CHOICE_COUNT = 2

/** Навыки D&D 5e для шага «Навыки» мастера */
export interface CreatorSkillOption {
  id: string
  label: string
  ability: AbilityScoreKey
}

export const CREATOR_SKILL_OPTIONS: CreatorSkillOption[] = [
  { id: 'athletics', label: 'Атлетика', ability: 'str' },
  { id: 'acrobatics', label: 'Акробатика', ability: 'dex' },
  { id: 'sleight', label: 'Ловкость рук', ability: 'dex' },
  { id: 'stealth', label: 'Скрытность', ability: 'dex' },
  { id: 'arcana', label: 'Магия', ability: 'int' },
  { id: 'history', label: 'История', ability: 'int' },
  { id: 'investigation', label: 'Анализ', ability: 'int' },
  { id: 'nature', label: 'Природа', ability: 'int' },
  { id: 'religion', label: 'Религия', ability: 'int' },
  { id: 'animal', label: 'Обращение с животными', ability: 'wis' },
  { id: 'insight', label: 'Проницательность', ability: 'wis' },
  { id: 'medicine', label: 'Медицина', ability: 'wis' },
  { id: 'perception', label: 'Внимание', ability: 'wis' },
  { id: 'survival', label: 'Выживание', ability: 'wis' },
  { id: 'deception', label: 'Обман', ability: 'cha' },
  { id: 'intimidation', label: 'Запугивание', ability: 'cha' },
  { id: 'performance', label: 'Выступление', ability: 'cha' },
  { id: 'persuasion', label: 'Убеждение', ability: 'cha' },
]

export interface CharacterCreateDraft {
  name: string
  backstory: string
  /** строка уровня для input type="text" или number */
  level: string
  raceId: string
  classId: string
  /** Значения 8–15, point-buy */
  abilityScores: CharacterAbilityScores
  /** id из CREATOR_SKILL_OPTIONS, ровно SKILL_CHOICE_COUNT для перехода дальше */
  proficientSkillIds: string[]
  /** Файл аватара: загружается на сервер после complete */
  pendingAvatarFile: File | null
}

export function defaultCharacterCreateDraft(): CharacterCreateDraft {
  return {
    name: '',
    backstory: '',
    level: '1',
    raceId: DEMO_RACES[0]?.id ?? 'human',
    classId: DEMO_CLASSES[0]?.id ?? 'fighter',
    abilityScores: defaultAbilityScores(),
    proficientSkillIds: [],
    pendingAvatarFile: null,
  }
}

function buildAbilitiesFromDraftScores(scores: CharacterAbilityScores): AbilityColumn[] {
  return DEMO_CHARACTER_SHEETS.torrin.abilities.map((col) => {
    const key = col.id as AbilityScoreKey
    const score = scores[key] ?? 8
    return {
      ...col,
      score,
      modifier: formatAbilityModifier(score),
      skills: [],
    }
  })
}

/** Заполняет строки навыков в колонках характеристик (как в превью мастера создания). */
export function fillAbilitySkillRows(
  columns: AbilityColumn[],
  proficientSkillIds: string[],
  characterLevel: number
): AbilityColumn[] {
  const proficient = new Set(proficientSkillIds)
  const pb = proficiencyBonus(characterLevel)
  const cols = columns.map((c) => ({
    ...c,
    skills: [] as SkillRow[],
  }))
  const byAbility = Object.fromEntries(cols.map((c) => [c.id, c])) as Record<AbilityScoreKey, AbilityColumn>

  const sorted = [...CREATOR_SKILL_OPTIONS].sort((a, b) => {
    const ai = ABILITY_SCORE_KEYS.indexOf(a.ability)
    const bi = ABILITY_SCORE_KEYS.indexOf(b.ability)
    if (ai !== bi) return ai - bi
    return a.label.localeCompare(b.label, 'ru')
  })

  for (const opt of sorted) {
    const col = byAbility[opt.ability]
    if (!col) continue
    const abilityMod = Math.floor((col.score - 10) / 2)
    const total = abilityMod + (proficient.has(opt.id) ? pb : 0)
    col.skills.push({ name: opt.label, bonus: formatSignedBonus(total) })
  }

  return cols
}

function fillAllSkillsForDraft(
  columns: AbilityColumn[],
  _scores: CharacterAbilityScores,
  proficientSkillIds: string[],
  characterLevel: number
): AbilityColumn[] {
  return fillAbilitySkillRows(columns, proficientSkillIds, characterLevel)
}

export function createCharacterSheetFromDraft(
  id: string,
  draft: CharacterCreateDraft,
  portraitUrl?: string | null
): CharacterSheet {
  const race = DEMO_RACES.find((r) => r.id === draft.raceId)?.label ?? ''
  const cls = DEMO_CLASSES.find((c) => c.id === draft.classId)?.label ?? ''
  const levelRaw = draft.level.trim()
  const levelNum = Math.min(20, Math.max(1, parseInt(levelRaw, 10) || 1))
  const name = draft.name.trim() || 'Новый персонаж'
  const displayTitle = `${name}, ${race} — ${cls} (ур. ${levelNum})`
  const history = draft.backstory.trim() || 'Предыстория пока не заполнена.'

  return {
    id,
    breadcrumbTail: 'Лагерь',
    displayTitle,
    listSubtitle: cls,
    questTags: [],
    portraitUrl: portraitUrl ?? null,
    hits: 10 + levelNum,
    ac: 10 + Math.floor(levelNum / 4),
    speed: 30,
    abilities: fillAllSkillsForDraft(
      buildAbilitiesFromDraftScores(draft.abilityScores),
      draft.abilityScores,
      draft.proficientSkillIds,
      levelNum
    ),
    history,
  }
}

export function previewCharacterSheetFromDraft(draft: CharacterCreateDraft): CharacterSheet {
  return createCharacterSheetFromDraft('__preview__', draft)
}
