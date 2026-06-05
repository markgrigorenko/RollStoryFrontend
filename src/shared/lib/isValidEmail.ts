/**
 * Проверка формата email (практичный вариант: не пустая строка, один «@», домен с точкой).
 */
export function isValidEmail(value: string): boolean {
  const v = value.trim()
  if (v.length === 0 || v.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
