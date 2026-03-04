import type { AdvancedSetType } from './db';

export const DEFAULT_SET_TYPE: AdvancedSetType = 'normal';
export const SET_TYPE_OPTIONS: Array<{
  type: AdvancedSetType;
  badge: string;
  label: string;
  description: string;
}> = [
  {
    type: 'normal',
    badge: '1',
    label: 'Serie normal',
    description: 'Cuenta como working set estándar.'
  },
  {
    type: 'warmup',
    badge: 'W',
    label: 'Warm-up',
    description: 'Serie preparatoria. Cuenta para volumen, no para PR ni progresión.'
  },
  {
    type: 'drop',
    badge: 'D',
    label: 'Drop',
    description: 'Set normal con marca especial; cuenta para volumen.'
  },
  {
    type: 'failure',
    badge: 'F',
    label: 'Fallo',
    description: 'Set al fallo; sí cuenta para PR y progresión.'
  },
  {
    type: 'amrap',
    badge: 'A',
    label: 'AMRAP',
    description: 'Tantas reps como sea posible con los valores reales registrados.'
  }
];

export function normalizeSetType(value?: AdvancedSetType | null): AdvancedSetType {
  if (value === 'warmup' || value === 'drop' || value === 'failure' || value === 'amrap') {
    return value;
  }
  return DEFAULT_SET_TYPE;
}

export function getSetTypeAtIndex(
  setTypes: Array<AdvancedSetType | undefined> | undefined,
  index: number
): AdvancedSetType {
  return normalizeSetType(setTypes?.[index]);
}

export function getSetTypeMeta(type: AdvancedSetType | undefined, setIndex: number) {
  const normalized = normalizeSetType(type);
  if (normalized === 'normal') {
    return {
      type: normalized,
      badge: String(setIndex + 1),
      label: `Serie ${setIndex + 1}`
    };
  }

  const option = SET_TYPE_OPTIONS.find((item) => item.type === normalized);
  return {
    type: normalized,
    badge: option?.badge ?? String(setIndex + 1),
    label: option?.label ?? `Serie ${setIndex + 1}`
  };
}

export function normalizeSetTypeArray(
  setTypes: Array<AdvancedSetType | undefined> | undefined,
  totalSets: number
) {
  if (!setTypes?.length) {
    return Array.from({ length: totalSets }, () => DEFAULT_SET_TYPE);
  }
  return Array.from({ length: totalSets }, (_, index) => normalizeSetType(setTypes[index]));
}

export function countsForVolume(_type?: AdvancedSetType | null) {
  return true;
}

export function countsForPr(type?: AdvancedSetType | null) {
  const normalized = normalizeSetType(type);
  return normalized === 'normal' || normalized === 'failure' || normalized === 'amrap';
}

export function countsForProgression(type?: AdvancedSetType | null) {
  const normalized = normalizeSetType(type);
  return normalized === 'normal' || normalized === 'failure' || normalized === 'amrap';
}
