/**
 * Координаты пинов для первичной инициализации кампании.
 * Карта: src/assets/maps/map.jpg (Sword Coast), Leaflet CRS.Simple — пиксели [0, mw] × [0, mh].
 *
 * x = lng, y = lat (как в API локаций). Берег идёт дугой: для каждой широты свой
 * минимальный x суши (~6500–7000 к югу, ~6200–6800 к северу).
 */
export const CAMPAIGN_MAP_WIDTH = 10200
export const CAMPAIGN_MAP_HEIGHT = 6600

/** x = lng, y = lat (как в API локаций). */
export const BOOTSTRAP_LOCATION_PINS = {
  /** Серые Кряжи — север, хребет у Silver Marches / Silverymoon. */
  greyRidges: { x: 7600, y: 850 },
  /** Лиарен-Кал — туманная долина в High Forest (Star Mounts). */
  liaren: { x: 7350, y: 1510 },
  /** Замок Доуида — прибрежный замок у Waterdeep. */
  dowidCastle: { x: 7300, y: 2630 },
} as const
