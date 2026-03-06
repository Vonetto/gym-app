export const MUSCLE_TO_SLUGS: Record<string, string[]> = {
  'Pectoralis major': ['chest'],
  'Serratus anterior': ['obliques'],
  'Anterior deltoid': ['deltoids'],
  'Biceps brachii': ['biceps'],
  Brachialis: ['biceps'],
  'Triceps brachii': ['triceps'],
  'Rectus abdominis': ['abs'],
  'Obliquus externus abdominis': ['obliques'],
  'Quadriceps femoris': ['quadriceps'],
  'Biceps femoris': ['hamstring'],
  'Gluteus maximus': ['gluteal'],
  'Latissimus dorsi': ['upper-back'],
  Trapezius: ['trapezius'],
  Gastrocnemius: ['calves'],
  Soleus: ['calves']
};

export const SLUG_LABELS: Record<string, string> = {
  abs: 'Abdominales',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Pantorrillas',
  chest: 'Pecho',
  deltoids: 'Hombros',
  gluteal: 'Glúteos',
  hamstring: 'Isquiotibiales',
  'lower-back': 'Espalda baja',
  obliques: 'Oblicuos',
  quadriceps: 'Cuádriceps',
  trapezius: 'Trapecio',
  triceps: 'Tríceps',
  'upper-back': 'Espalda'
};

export const getIntensityRatio = (value: number, max: number) => {
  if (max <= 0 || value <= 0) return 0;
  return Math.sqrt(value / max);
};

export const getIntensityColor = (intensity: number) => {
  if (intensity <= 0) return '#1d1d1d';
  const alpha = 0.2 + intensity * 0.8;
  return `rgba(45, 140, 255, ${alpha})`;
};

export const buildSlugVolumes = (muscleVolumes: Record<string, number>) => {
  const totals: Record<string, number> = {};
  Object.entries(muscleVolumes).forEach(([muscle, volume]) => {
    const slugs = MUSCLE_TO_SLUGS[muscle];
    if (!slugs || volume <= 0) return;
    const share = 1 / slugs.length;
    slugs.forEach((slug) => {
      totals[slug] = (totals[slug] ?? 0) + volume * share;
    });
  });
  return totals;
};

export const getMuscleWeights = (
  primaryMuscles: string[],
  secondaryMuscles: string[] = []
): Array<[string, number]> => {
  const primary = [...new Set(primaryMuscles.filter(Boolean))];
  const secondary = [...new Set(secondaryMuscles.filter(Boolean))].filter(
    (muscle) => !primary.includes(muscle)
  );

  if (!primary.length && !secondary.length) return [];
  if (!secondary.length) {
    const share = 1 / primary.length;
    return primary.map((muscle) => [muscle, share]);
  }
  if (!primary.length) {
    const share = 1 / secondary.length;
    return secondary.map((muscle) => [muscle, share]);
  }

  const primaryShare = 0.75 / primary.length;
  const secondaryShare = 0.25 / secondary.length;
  return [
    ...primary.map((muscle) => [muscle, primaryShare] as [string, number]),
    ...secondary.map((muscle) => [muscle, secondaryShare] as [string, number])
  ];
};

export const MUSCLE_DECAY_HALF_LIFE_DAYS = 7;
