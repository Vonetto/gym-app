import {
  db,
  PlannedWorkoutOccurrenceRecord,
  PlannedWorkoutSeriesKind,
  PlannedWorkoutSeriesRecord,
  PlannedWorkoutStatus
} from './db';
import { addDaysLocal, compareLocalDate, getIsoWeekday } from './localDate';

export interface CreatePlannedWorkoutSeriesInput {
  routineId: string;
  kind: PlannedWorkoutSeriesKind;
  startDate: string;
  weekdays?: number[];
  endDate?: string;
}

export interface PlannedWorkoutOccurrenceView {
  id: string;
  seriesId: string;
  routineId: string;
  occurrenceDate: string;
  status: PlannedWorkoutStatus;
  workoutId?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function buildOccurrenceId(seriesId: string, occurrenceDate: string) {
  return `${seriesId}:${occurrenceDate}`;
}

function normalizeWeekdays(weekdays?: number[]) {
  return Array.from(new Set((weekdays ?? []).filter((day) => day >= 1 && day <= 7))).sort(
    (a, b) => a - b
  );
}

export async function createPlannedWorkoutSeries(input: CreatePlannedWorkoutSeriesInput) {
  const now = nowIso();
  const series: PlannedWorkoutSeriesRecord = {
    id: `plan-series-${crypto.randomUUID()}`,
    routineId: input.routineId,
    kind: input.kind,
    startDate: input.startDate,
    weekdays: input.kind === 'weekdays' ? normalizeWeekdays(input.weekdays) : undefined,
    endDate: input.endDate || undefined,
    createdAt: now,
    updatedAt: now
  };
  await db.plannedWorkoutSeries.add(series);
  return series;
}

export async function listPlannedWorkoutSeries() {
  const rows = await db.plannedWorkoutSeries.orderBy('startDate').toArray();
  return rows.filter((row) => !row.deletedAt);
}

export async function listPlannedWorkoutOccurrences() {
  const rows = await db.plannedWorkoutOccurrences.orderBy('occurrenceDate').toArray();
  return rows.filter((row) => !row.deletedAt);
}

export async function upsertPlannedWorkoutOccurrence(
  seriesId: string,
  occurrenceDate: string,
  status: PlannedWorkoutStatus,
  workoutId?: string
) {
  const now = nowIso();
  const id = buildOccurrenceId(seriesId, occurrenceDate);
  const existing = await db.plannedWorkoutOccurrences.get(id);
  const record: PlannedWorkoutOccurrenceRecord = {
    id,
    seriesId,
    occurrenceDate,
    status,
    workoutId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.plannedWorkoutOccurrences.put(record);
  return record;
}

export async function deletePlannedWorkoutSeries(seriesId: string) {
  const now = nowIso();
  await db.transaction(
    'rw',
    [db.plannedWorkoutSeries, db.plannedWorkoutOccurrences],
    async () => {
      await db.plannedWorkoutSeries.update(seriesId, {
        updatedAt: now,
        deletedAt: now
      });
      const occurrenceRows = await db.plannedWorkoutOccurrences
        .where('seriesId')
        .equals(seriesId)
        .toArray();
      if (occurrenceRows.length) {
        await Promise.all(
          occurrenceRows.map((row) =>
            db.plannedWorkoutOccurrences.update(row.id, {
              updatedAt: now,
              deletedAt: now
            })
          )
        );
      }
    }
  );
}

function expandSeriesIntoDates(
  series: PlannedWorkoutSeriesRecord,
  rangeStart: string,
  rangeEnd: string
) {
  if (series.deletedAt) return [] as string[];
  const effectiveStart =
    compareLocalDate(rangeStart, series.startDate) > 0 ? rangeStart : series.startDate;
  const effectiveEnd =
    series.endDate && compareLocalDate(series.endDate, rangeEnd) < 0 ? series.endDate : rangeEnd;
  if (compareLocalDate(effectiveStart, effectiveEnd) > 0) return [] as string[];

  if (series.kind === 'once') {
    return compareLocalDate(series.startDate, effectiveStart) >= 0 &&
      compareLocalDate(series.startDate, effectiveEnd) <= 0
      ? [series.startDate]
      : [];
  }

  const dates: string[] = [];
  const weekdaySet = new Set(normalizeWeekdays(series.weekdays));
  const startTime = Date.parse(`${series.startDate}T00:00:00`);
  let current = effectiveStart;

  while (compareLocalDate(current, effectiveEnd) <= 0) {
    if (series.kind === 'weekly') {
      const deltaDays = Math.round((Date.parse(`${current}T00:00:00`) - startTime) / 86400000);
      if (deltaDays >= 0 && deltaDays % 7 === 0) {
        dates.push(current);
      }
    } else if (series.kind === 'weekdays') {
      if (compareLocalDate(current, series.startDate) >= 0 && weekdaySet.has(getIsoWeekday(current))) {
        dates.push(current);
      }
    }
    current = addDaysLocal(current, 1);
  }

  return dates;
}

export async function listPlannedOccurrencesForRange(rangeStart: string, rangeEnd: string) {
  const [seriesRows, occurrenceRows] = await Promise.all([
    listPlannedWorkoutSeries(),
    listPlannedWorkoutOccurrences()
  ]);
  const occurrenceMap = new Map(
    occurrenceRows.map((row) => [buildOccurrenceId(row.seriesId, row.occurrenceDate), row])
  );

  return seriesRows
    .flatMap((series) =>
      expandSeriesIntoDates(series, rangeStart, rangeEnd).map((occurrenceDate) => {
        const override = occurrenceMap.get(buildOccurrenceId(series.id, occurrenceDate));
        return {
          id: buildOccurrenceId(series.id, occurrenceDate),
          seriesId: series.id,
          routineId: series.routineId,
          occurrenceDate,
          status: override?.status ?? 'pending',
          workoutId: override?.workoutId
        } satisfies PlannedWorkoutOccurrenceView;
      })
    )
    .sort((a, b) => {
      const dateCompare = compareLocalDate(a.occurrenceDate, b.occurrenceDate);
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });
}
