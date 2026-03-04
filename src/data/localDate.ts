export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function compareLocalDate(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function addDaysLocal(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  };
}

export function getIsoWeekday(value: string) {
  const weekday = parseLocalDate(value).getDay();
  return weekday === 0 ? 7 : weekday;
}

export function getTodayLocalDate() {
  return formatLocalDate(new Date());
}
