import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

type NotificationPreferencesRow = {
  user_id: string;
  planned_reminder_time: string;
  planned_reminder_offset_minutes: number;
  timezone: string;
};

type ScheduleSeriesRow = {
  id: string;
  routine_id: string;
  kind: 'once' | 'weekly' | 'weekdays';
  start_date: string;
  weekdays: number[] | null;
  end_date: string | null;
};

type RoutineRow = {
  id: string;
  name: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  subscription_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DeliveryRow = {
  id: string;
};

type ReminderCandidate = {
  userId: string;
  routineId: string;
  routineName: string;
  occurrenceDate: string;
  occurrenceId: string;
  scheduledAtIso: string;
  timezone: string;
  reminderTime: string;
  offsetMinutes: number;
  deliveryId: string;
};

type RequestPayload = {
  now?: string;
  dryRun?: boolean;
  userId?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const DEFAULT_LOOKBACK_SECONDS = 300;
const DELIVERY_KIND = 'planned-workout-reminder';

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

function getIsoWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function compareDateKey(left: string, right: string) {
  return left.localeCompare(right);
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function getLocalDateKey(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function parseReminderTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return { hour: 19, minute: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 19, minute: 0 };
  }
  return { hour, minute };
}

function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const { hour, minute } = parseReminderTime(time);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const desiredEpoch = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let index = 0; index < 5; index += 1) {
    const parts = getTimeZoneParts(guess, timeZone);
    const observedEpoch = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const diff = desiredEpoch - observedEpoch;
    if (diff === 0) {
      return guess;
    }
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

function occursOnDate(series: ScheduleSeriesRow, dateKey: string) {
  if (compareDateKey(dateKey, series.start_date) < 0) return false;
  if (series.end_date && compareDateKey(dateKey, series.end_date) > 0) return false;

  if (series.kind === 'once') {
    return compareDateKey(series.start_date, dateKey) === 0;
  }

  if (series.kind === 'weekly') {
    const startTime = Date.parse(`${series.start_date}T00:00:00Z`);
    const currentTime = Date.parse(`${dateKey}T00:00:00Z`);
    const deltaDays = Math.round((currentTime - startTime) / 86400000);
    return deltaDays >= 0 && deltaDays % 7 === 0;
  }

  const weekdays = Array.isArray(series.weekdays) ? series.weekdays : [];
  return weekdays.includes(getIsoWeekday(dateKey));
}

function buildOccurrenceId(seriesId: string, occurrenceDate: string) {
  return `${seriesId}:${occurrenceDate}`;
}

function buildDeliveryId(
  userId: string,
  occurrenceId: string,
  reminderTime: string,
  offsetMinutes: number
) {
  return `${DELIVERY_KIND}:${userId}:${occurrenceId}:${reminderTime}:${offsetMinutes}`;
}

function getScheduledReminderDate(
  occurrenceDate: string,
  reminderTime: string,
  offsetMinutes: number,
  timeZone: string
) {
  const scheduledAt = zonedDateTimeToUtc(occurrenceDate, reminderTime, timeZone);
  return new Date(scheduledAt.getTime() - offsetMinutes * 60_000);
}

function buildReminderBody(candidate: ReminderCandidate, now: Date) {
  const todayKey = getLocalDateKey(now, candidate.timezone);
  const scheduledLabel = candidate.reminderTime;
  const dateLabel = candidate.occurrenceDate.split('-').reverse().join('/');

  if (candidate.occurrenceDate === todayKey) {
    if (candidate.offsetMinutes > 0) {
      return `Hoy te toca ${candidate.routineName}. Recordatorio ${candidate.offsetMinutes} min antes de las ${scheduledLabel}.`;
    }
    return `Hoy te toca ${candidate.routineName}. Recordatorio configurado para las ${scheduledLabel}.`;
  }

  return `Rutina ${candidate.routineName} planificada para ${dateLabel}. Recordatorio ${candidate.offsetMinutes > 0 ? `${candidate.offsetMinutes} min antes de las ${scheduledLabel}` : `a las ${scheduledLabel}`}.`;
}

function getAuthorizationToken(request: Request) {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function getStatusCode(error: unknown) {
  if (typeof error === 'object' && error && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') {
      return statusCode;
    }
  }
  return undefined;
}

async function loadEligibleUsers(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string
): Promise<NotificationPreferencesRow[]> {
  let query = supabaseAdmin
    .from('user_notification_preferences')
    .select('user_id, planned_reminder_time, planned_reminder_offset_minutes, timezone')
    .eq('notifications_enabled', true)
    .eq('planned_enabled', true);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function loadActiveSubscriptions(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabaseAdmin
    .from('user_push_subscriptions')
    .select('id, endpoint, subscription_json, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

async function loadScheduleSeries(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  minDate: string,
  maxDate: string
): Promise<ScheduleSeriesRow[]> {
  const { data, error } = await supabaseAdmin
    .from('user_schedule_series')
    .select('id, routine_id, kind, start_date, weekdays, end_date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .lte('start_date', maxDate)
    .or(`end_date.is.null,end_date.gte.${minDate}`);
  if (error) throw error;
  return data ?? [];
}

async function loadRoutineNames(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  routineIds: string[]
): Promise<Map<string, string>> {
  if (!routineIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('user_routines')
    .select('id, name')
    .eq('user_id', userId)
    .in('id', routineIds)
    .is('deleted_at', null);
  if (error) throw error;
  return new Map(((data ?? []) as RoutineRow[]).map((row) => [row.id, row.name]));
}

async function loadExistingDeliveries(
  supabaseAdmin: ReturnType<typeof createClient>,
  deliveryIds: string[]
): Promise<Set<string>> {
  if (!deliveryIds.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from('user_notification_deliveries')
    .select('id')
    .in('id', deliveryIds);
  if (error) throw error;
  return new Set(((data ?? []) as DeliveryRow[]).map((row) => row.id));
}

function collectDueCandidates(
  preferences: NotificationPreferencesRow,
  seriesRows: ScheduleSeriesRow[],
  routineNames: Map<string, string>,
  now: Date,
  lookbackMs: number
) {
  const minCandidateDate = addDays(getLocalDateKey(new Date(now.getTime() - 86_400_000), preferences.timezone), 0);
  const maxCandidateDate = addDays(getLocalDateKey(new Date(now.getTime() + 86_400_000), preferences.timezone), 0);

  const candidates: ReminderCandidate[] = [];
  let currentDate = minCandidateDate;
  while (compareDateKey(currentDate, maxCandidateDate) <= 0) {
    for (const series of seriesRows) {
      if (!occursOnDate(series, currentDate)) continue;
      const routineName = routineNames.get(series.routine_id);
      if (!routineName) continue;

      const scheduledAt = getScheduledReminderDate(
        currentDate,
        preferences.planned_reminder_time,
        preferences.planned_reminder_offset_minutes,
        preferences.timezone || 'UTC'
      );
      const delta = now.getTime() - scheduledAt.getTime();
      if (delta < 0 || delta > lookbackMs) continue;

      const occurrenceId = buildOccurrenceId(series.id, currentDate);
      candidates.push({
        userId: preferences.user_id,
        routineId: series.routine_id,
        routineName,
        occurrenceDate: currentDate,
        occurrenceId,
        scheduledAtIso: scheduledAt.toISOString(),
        timezone: preferences.timezone || 'UTC',
        reminderTime: preferences.planned_reminder_time,
        offsetMinutes: preferences.planned_reminder_offset_minutes,
        deliveryId: buildDeliveryId(
          preferences.user_id,
          occurrenceId,
          preferences.planned_reminder_time,
          preferences.planned_reminder_offset_minutes
        )
      });
    }
    currentDate = addDays(currentDate, 1);
  }
  return candidates;
}

async function markSubscriptionDeleted(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  subscription: PushSubscriptionRow
) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('user_push_subscriptions').upsert(
    [
      {
        user_id: userId,
        id: subscription.id,
        endpoint: subscription.endpoint,
        subscription_json: subscription.subscription_json,
        created_at: subscription.created_at,
        updated_at: now,
        deleted_at: now
      }
    ],
    { onConflict: 'user_id,id' }
  );
  if (error) {
    console.error('Failed to soft-delete invalid push subscription', {
      userId,
      subscriptionId: subscription.id,
      error
    });
  }
}

async function sendReminder(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscriptions: PushSubscriptionRow[],
  candidate: ReminderCandidate,
  now: Date,
  dryRun: boolean
) {
  const payload = {
    title: 'Rutina planificada',
    body: buildReminderBody(candidate, now),
    tag: `planned-${candidate.occurrenceId}`,
    url: `/calendar?date=${candidate.occurrenceDate}`,
    requireInteraction: true,
    data: {
      occurrenceDate: candidate.occurrenceDate,
      routineId: candidate.routineId,
      deliveryId: candidate.deliveryId
    }
  };

  if (dryRun) {
    return {
      sent: 0,
      invalidSubscriptions: 0,
      payload
    };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription.subscription_json as never, JSON.stringify(payload), {
          TTL: 300,
          urgency: 'normal'
        });
        return { ok: true as const, subscription };
      } catch (error) {
        return { ok: false as const, subscription, error };
      }
    })
  );

  let sent = 0;
  let invalidSubscriptions = 0;

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue;
    }
    if (result.value.ok) {
      sent += 1;
      continue;
    }

    const statusCode = getStatusCode(result.value.error);
    if (statusCode === 404 || statusCode === 410) {
      invalidSubscriptions += 1;
      await markSubscriptionDeleted(supabaseAdmin, candidate.userId, result.value.subscription);
    } else {
      console.error('Push send failed', {
        userId: candidate.userId,
        deliveryId: candidate.deliveryId,
        subscriptionId: result.value.subscription.id,
        error: result.value.error
      });
    }
  }

  if (sent > 0) {
    const { error } = await supabaseAdmin.from('user_notification_deliveries').insert({
      id: candidate.deliveryId,
      user_id: candidate.userId,
      kind: DELIVERY_KIND,
      occurrence_id: candidate.occurrenceId,
      delivered_at: new Date().toISOString(),
      payload
    });

    if (error) {
      console.error('Failed to persist delivery log', {
        userId: candidate.userId,
        deliveryId: candidate.deliveryId,
        error
      });
    }
  }

  return {
    sent,
    invalidSubscriptions,
    payload
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  try {
    const cronSecret = getRequiredEnv('CRON_SECRET');
    const token = getAuthorizationToken(request);
    if (token !== cronSecret) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = getRequiredEnv('PUSH_VAPID_PUBLIC_KEY');
    const vapidPrivateKey = getRequiredEnv('PUSH_VAPID_PRIVATE_KEY');
    const vapidSubject = getRequiredEnv('PUSH_VAPID_SUBJECT');
    const lookbackSeconds = Number(Deno.env.get('REMINDER_LOOKBACK_SECONDS') ?? DEFAULT_LOOKBACK_SECONDS);

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = ((await request.json().catch(() => ({}))) ?? {}) as RequestPayload;
    const now = payload.now ? new Date(payload.now) : new Date();
    if (Number.isNaN(now.getTime())) {
      return jsonResponse(400, { error: 'invalid_now' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const users = await loadEligibleUsers(supabaseAdmin, payload.userId);
    const summary = {
      scannedUsers: users.length,
      skippedUsersWithoutSubscriptions: 0,
      dueCandidates: 0,
      alreadyDelivered: 0,
      sentNotifications: 0,
      invalidSubscriptions: 0,
      dryRun: Boolean(payload.dryRun),
      users: [] as Array<Record<string, unknown>>
    };

    for (const user of users) {
      try {
        const [subscriptions, seriesRows] = await Promise.all([
          loadActiveSubscriptions(supabaseAdmin, user.user_id),
          loadScheduleSeries(
            supabaseAdmin,
            user.user_id,
            addDays(getLocalDateKey(new Date(now.getTime() - 86_400_000), user.timezone || 'UTC'), 0),
            addDays(getLocalDateKey(new Date(now.getTime() + 86_400_000), user.timezone || 'UTC'), 0)
          )
        ]);

        if (!subscriptions.length) {
          summary.skippedUsersWithoutSubscriptions += 1;
          summary.users.push({
            userId: user.user_id,
            due: 0,
            sent: 0,
            skipped: 'no-subscriptions'
          });
          continue;
        }

        const routineNames = await loadRoutineNames(
          supabaseAdmin,
          user.user_id,
          Array.from(new Set(seriesRows.map((row) => row.routine_id)))
        );

        const candidates = collectDueCandidates(
          user,
          seriesRows,
          routineNames,
          now,
          Math.max(60, lookbackSeconds) * 1000
        );

        if (!candidates.length) {
          summary.users.push({
            userId: user.user_id,
            due: 0,
            sent: 0
          });
          continue;
        }

        summary.dueCandidates += candidates.length;
        const existingDeliveries = await loadExistingDeliveries(
          supabaseAdmin,
          candidates.map((candidate) => candidate.deliveryId)
        );
        const pendingCandidates = candidates.filter(
          (candidate) => !existingDeliveries.has(candidate.deliveryId)
        );
        summary.alreadyDelivered += candidates.length - pendingCandidates.length;

        let userSent = 0;
        let userInvalidSubscriptions = 0;
        const userPayloads: Array<Record<string, unknown>> = [];

        for (const candidate of pendingCandidates) {
          const result = await sendReminder(
            supabaseAdmin,
            subscriptions,
            candidate,
            now,
            Boolean(payload.dryRun)
          );
          userSent += result.sent;
          userInvalidSubscriptions += result.invalidSubscriptions;
          userPayloads.push({
            deliveryId: candidate.deliveryId,
            occurrenceDate: candidate.occurrenceDate,
            routineName: candidate.routineName,
            scheduledAt: candidate.scheduledAtIso,
            payload: result.payload,
            sent: result.sent,
            invalidSubscriptions: result.invalidSubscriptions
          });
        }

        summary.sentNotifications += userSent;
        summary.invalidSubscriptions += userInvalidSubscriptions;
        summary.users.push({
          userId: user.user_id,
          due: candidates.length,
          pending: pendingCandidates.length,
          sent: userSent,
          invalidSubscriptions: userInvalidSubscriptions,
          reminders: userPayloads
        });
      } catch (error) {
        console.error('planned-reminders user failure', {
          userId: user.user_id,
          error
        });
        summary.users.push({
          userId: user.user_id,
          error: error instanceof Error ? error.message : 'unknown_error'
        });
      }
    }

    return jsonResponse(200, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    const status = message.startsWith('missing_env:') ? 503 : 500;
    return jsonResponse(status, { error: message });
  }
});
