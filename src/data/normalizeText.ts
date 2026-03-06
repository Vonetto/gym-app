const diacriticRegex = /\p{Diacritic}/gu;

export function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(diacriticRegex, '');
}

