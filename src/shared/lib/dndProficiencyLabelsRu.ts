import { CREATOR_SKILL_OPTIONS } from '@/types/character-campaign'

/** API-индекс навыка → id в CREATOR_SKILL_OPTIONS */
const SKILL_INDEX_ALIASES: Record<string, string> = {
  'animal-handling': 'animal',
  'sleight-of-hand': 'sleight',
  'sleight_of_hand': 'sleight',
}

const SKILL_LABEL_BY_ID = Object.fromEntries(
  CREATOR_SKILL_OPTIONS.map((s) => [s.id, s.label])
) as Record<string, string>

const MUSICAL_INSTRUMENTS_RU: Record<string, string> = {
  bagpipes: 'Волынка',
  drum: 'Барабан',
  dulcimer: 'Цимбалы',
  flute: 'Флейта',
  lute: 'Лютня',
  lyre: 'Лира',
  horn: 'Рог',
  'pan-flute': 'Свирель',
  'pan_flute': 'Свирель',
  shawm: 'Шалмей',
  viol: 'Виол',
}

const TOOLS_RU: Record<string, string> = {
  'alchemists-supplies': 'Алхимические принадлежности',
  'brewers-supplies': 'Пивоварение',
  'calligraphers-supplies': 'Каллиграфия',
  'carpenters-tools': 'Столярные инструменты',
  'cartographers-tools': 'Инструменты картографа',
  'cobblers-tools': 'Сапожные инструменты',
  'cooks-utensils': 'Кухонная утварь',
  'glassblowers-tools': 'Стеклодувное дело',
  'jewelers-tools': 'Ювелирные инструменты',
  'leatherworkers-tools': 'Кожевенное дело',
  'masons-tools': 'Инструменты каменщика',
  'painters-supplies': 'Живопись',
  'potters-tools': 'Гончарное дело',
  'smiths-tools': 'Кузнечное дело',
  'tinkers-tools': 'Жестянщик',
  'weavers-tools': 'Ткачество',
  'woodcarvers-tools': 'Резьба по дереву',
  'navigators-tools': 'Инструменты навигатора',
  'poisoners-kit': 'Набор отравителя',
  'thieves-tools': 'Воровские инструменты',
  'disguise-kit': 'Набор для маскировки',
  'forgery-kit': 'Набор для подделки',
  'herbalism-kit': 'Набор травника',
  'gaming-set': 'Набор для игр',
  'dice-set': 'Игральные кости',
  'dragonchess-set': 'Драконьи шахматы',
  'playing-card-set': 'Игральные карты',
  'three-dragon-ante-set': 'Три дракона',
  'vehicles-land': 'Наземный транспорт',
  'vehicles-water': 'Водный транспорт',
}

const LANGUAGES_RU: Record<string, string> = {
  common: 'Общий',
  dwarvish: 'Дварфийский',
  elvish: 'Эльфийский',
  giant: 'Великаний',
  gnomish: 'Гномий',
  goblin: 'Гоблинский',
  halfling: 'Халфлингский',
  orc: 'Орочий',
  abyssal: 'Бездны',
  celestial: 'Небесный',
  draconic: 'Драконий',
  'deep-speech': 'Подземный',
  infernal: 'Инфернальный',
  primordial: 'Первозданный',
  sylvan: 'Сильван',
  undercommon: 'Подобщий',
}

const GROUP_DESC_EXACT_RU: Record<string, string> = {
  'Choose any three': 'Выберите любые три',
  'Choose any two': 'Выберите любые два',
  'Choose any one': 'Выберите один',
  'Three musical instruments of your choice': 'Три музыкальных инструмента на ваш выбор',
  'Two musical instruments of your choice': 'Два музыкальных инструмента на ваш выбор',
  'One musical instrument of your choice': 'Один музыкальный инструмент на ваш выбор',
  "Choose one type of artisan's tools": 'Выберите один вид ремесленных инструментов',
  "Choose one type of gaming set": 'Выберите один игровой набор',
  'Choose two languages': 'Выберите два языка',
  'Choose one language': 'Выберите один язык',
  'Choose two skills': 'Выберите два навыка',
  'Choose three skills': 'Выберите три навыка',
  'Choose two tool proficiencies': 'Выберите два владения инструментами',
}

function normalizeIndex(index: string): string {
  return index.trim().toLowerCase().replace(/_/g, '-')
}

function localizeSkillByIndex(index: string): string | null {
  const norm = normalizeIndex(index).replace(/^skill-/, '')
  const creatorId = SKILL_INDEX_ALIASES[norm] ?? norm
  return SKILL_LABEL_BY_ID[creatorId] ?? SKILL_LABEL_BY_ID[norm] ?? null
}

function localizeByIndex(index: string): string | null {
  const norm = normalizeIndex(index)
  return (
    localizeSkillByIndex(norm) ??
    MUSICAL_INSTRUMENTS_RU[norm] ??
    TOOLS_RU[norm] ??
    LANGUAGES_RU[norm] ??
    null
  )
}

/** «Skill: Acrobatics» → «Акробатика» */
function localizePrefixedName(name: string): string | null {
  const m = /^(Skill|Tool|Language|Musical Instrument):\s*(.+)$/i.exec(name.trim())
  if (!m) return null
  const kind = m[1]!.toLowerCase().replace(/\s+/g, '-')
  const raw = m[2]!.trim()
  const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')
  const bySlug =
    localizeSkillByIndex(slug) ??
    MUSICAL_INSTRUMENTS_RU[slug] ??
    TOOLS_RU[slug] ??
    LANGUAGES_RU[slug]
  if (bySlug) return bySlug
  if (kind === 'musical-instrument' || kind === 'musical') {
    return MUSICAL_INSTRUMENTS_RU[slug] ?? raw
  }
  return null
}

function localizePlainEnglishName(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')
  return (
    localizeSkillByIndex(slug) ??
    MUSICAL_INSTRUMENTS_RU[slug] ??
    TOOLS_RU[slug] ??
    LANGUAGES_RU[slug]
  )
}

export function localizeProficiencyOptionName(index: string, fallbackName: string): string {
  const byIndex = localizeByIndex(index)
  if (byIndex) return byIndex

  const byPrefix = localizePrefixedName(fallbackName)
  if (byPrefix) return byPrefix

  const byPlain = localizePlainEnglishName(fallbackName)
  if (byPlain) return byPlain

  return fallbackName.trim() || index
}

export function localizeProficiencyGroupDesc(desc: string): string {
  const trimmed = desc.trim()
  if (!trimmed) return desc

  const exact = GROUP_DESC_EXACT_RU[trimmed]
  if (exact) return exact

  const musical = /^(\w+)\s+musical instruments? of your choice$/i.exec(trimmed)
  if (musical) {
    const countWord = musical[1]!.toLowerCase()
    const countMap: Record<string, string> = {
      one: 'Один',
      two: 'Два',
      three: 'Три',
      four: 'Четыре',
    }
    const n = countMap[countWord] ?? musical[1]
    const suffix = countWord === 'one' ? 'музыкальный инструмент' : 'музыкальных инструмента'
    return `${n} ${suffix} на ваш выбор`
  }

  const chooseAny = /^choose any (one|two|three|four|five|six|\d+)$/i.exec(trimmed)
  if (chooseAny) {
    const n = chooseAny[1]!.toLowerCase()
    const map: Record<string, string> = {
      one: 'Выберите один',
      two: 'Выберите любые два',
      three: 'Выберите любые три',
      four: 'Выберите любые четыре',
      five: 'Выберите любые пять',
      six: 'Выберите любые шесть',
    }
    return map[n] ?? `Выберите любые ${n}`
  }

  const chooseFrom = /^choose (one|two|three|\d+) (skills?|languages?|tool(?:\s+proficiencies)?) from (.+)$/i.exec(
    trimmed
  )
  if (chooseFrom) {
    const count = chooseFrom[1]!
    const kind = chooseFrom[2]!.toLowerCase()
    const list = chooseFrom[3]!
    const countRu =
      count === 'one' ? 'один' : count === 'two' ? 'два' : count === 'three' ? 'три' : count
    const kindRu = kind.startsWith('skill')
      ? 'навыка'
      : kind.startsWith('language')
        ? 'языка'
        : 'инструмента'
    const items = list
      .split(',')
      .map((part) => localizePlainEnglishName(part.trim()) ?? part.trim())
      .join(', ')
    return `Выберите ${countRu} ${kindRu} из: ${items}`
  }

  const chooseType = /^choose (one|two) types? of (.+)$/i.exec(trimmed)
  if (chooseType) {
    const count = chooseType[1] === 'one' ? 'один вид' : 'два вида'
    const subject = chooseType[2]!.toLowerCase()
    const subjectRu =
      subject.includes("artisan")
        ? 'ремесленных инструментов'
        : subject.includes('gaming')
          ? 'игровых наборов'
          : subject
    return `Выберите ${count} ${subjectRu}`
  }

  if (/^proficiencies$/i.test(trimmed)) return 'Владения'

  return desc
}
