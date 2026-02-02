import { db, WrkoutTipRecord } from './db';
import { normalizeName } from './exercises';

const WRKOUT_BASE = 'https://api.wrkout.xyz';
const WRKOUT_TTL_DAYS = 180;

const isExpired = (iso: string) => {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs > WRKOUT_TTL_DAYS * 24 * 60 * 60 * 1000;
};

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const scoreCandidate = (local: string, candidate?: string) => {
  if (!candidate) return Number.POSITIVE_INFINITY;
  return levenshtein(normalizeName(local), normalizeName(candidate));
};

const extractTips = (payload: any) => {
  const bullets: string[] = [];
  const summary =
    typeof payload?.summary === 'string'
      ? payload.summary
      : typeof payload?.description === 'string'
      ? payload.description
      : typeof payload?.instructions === 'string'
      ? payload.instructions
      : undefined;

  const addList = (list: unknown) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (typeof item === 'string' && item.trim()) bullets.push(item.trim());
    });
  };

  addList(payload?.tips);
  addList(payload?.instructions);
  addList(payload?.steps);
  return { summary, bullets };
};

const fetchWrkout = async (path: string, apiKey: string) => {
  const response = await fetch(`${WRKOUT_BASE}${path}`, {
    headers: {
      'X-API-Key': apiKey
    }
  });
  if (!response.ok) {
    throw new Error(`wrkout:${response.status}`);
  }
  return response.json();
};

const findWrkoutMatch = async (name: string, apiKey: string) => {
  const params = new URLSearchParams({
    name,
    limit: '25',
    lang: 'en-GB',
    searchlang: 'en-GB'
  });
  const data = await fetchWrkout(`/exercise/query?${params.toString()}`, apiKey);
  const results: any[] = data?.exerciseIds ?? data?.results ?? data?.data ?? [];
  if (!Array.isArray(results) || results.length === 0) return null;
  let best = results[0];
  let bestScore = Number.POSITIVE_INFINITY;
  results.forEach((item) => {
    const candidates = [item.displayName, item.name, ...(item.aliases ?? [])];
    const score = Math.min(...candidates.map((candidate: string) => scoreCandidate(name, candidate)));
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  });
  return best?.id ?? best?.exerciseId ?? null;
};

export async function getWrkoutTips(
  exerciseId: string,
  exerciseName: string,
  apiKey?: string
): Promise<WrkoutTipRecord | null> {
  if (!apiKey) return null;
  const cached = await db.wrkoutTips.get(exerciseId);
  if (cached && !isExpired(cached.lastFetchedAt)) {
    return cached;
  }
  try {
    const wrkoutId = await findWrkoutMatch(exerciseName, apiKey);
    if (!wrkoutId) {
      const record = {
        exerciseId,
        lastFetchedAt: new Date().toISOString(),
        bullets: [],
        summary: undefined
      };
      await db.wrkoutTips.put(record);
      return record;
    }
    const detail = await fetchWrkout(`/exercise/${encodeURIComponent(wrkoutId)}?lang=en-GB`, apiKey);
    const { summary, bullets } = extractTips(detail);
    const record: WrkoutTipRecord = {
      exerciseId,
      wrkoutId,
      summary,
      bullets,
      lastFetchedAt: new Date().toISOString()
    };
    await db.wrkoutTips.put(record);
    return record;
  } catch (error) {
    if (cached) return cached;
    return null;
  }
}
