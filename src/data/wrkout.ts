import { db, WrkoutTipRecord } from './db';
import { normalizeName } from './exercises';

const WRKOUT_DIRECT_BASE = 'https://api.wrkout.xyz';
const WRKOUT_API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const WRKOUT_TTL_DAYS = 180;
type WrkoutStatus = 'ok' | 'missing' | 'auth' | 'error' | 'config';
type WrkoutErrorCode = 'auth' | 'fetch' | 'config';

const toWrkoutError = (message: string, code: WrkoutErrorCode) => {
  const error = new Error(message);
  (error as Error & { code?: WrkoutErrorCode }).code = code;
  return error;
};

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
      if (typeof item === 'string' && item.trim()) {
        bullets.push(item.trim());
        return;
      }
      if (typeof item === 'object' && item) {
        const candidate =
          (item as { text?: string }).text ||
          (item as { instruction?: string }).instruction ||
          (item as { value?: string }).value ||
          (item as { detail?: string }).detail ||
          (item as { description?: string }).description;
        if (candidate && candidate.trim()) {
          bullets.push(candidate.trim());
        }
      }
    });
  };

  addList(payload?.tips);
  addList(payload?.instructions);
  addList(payload?.steps);
  return { summary, bullets };
};

const fetchViaProxy = async (path: string) => {
  const response = await fetch(`${WRKOUT_API_BASE}/wrkout${path}`);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw toWrkoutError(`wrkout:${response.status}`, 'auth');
    }
    if (response.status === 503) {
      throw toWrkoutError(`wrkout:${response.status}`, 'config');
    }
    throw toWrkoutError(`wrkout:${response.status}`, 'fetch');
  }
  return response.json();
};

const fetchDirect = async (path: string, apiKey: string) => {
  const response = await fetch(`${WRKOUT_DIRECT_BASE}${path}`, {
    headers: {
      'X-API-Key': apiKey
    }
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw toWrkoutError(`wrkout:${response.status}`, 'auth');
    }
    throw toWrkoutError(`wrkout:${response.status}`, 'fetch');
  }
  return response.json();
};

const fetchWrkout = async (path: string, apiKey?: string) => {
  try {
    return await fetchViaProxy(path);
  } catch (error) {
    if (apiKey) {
      return fetchDirect(path, apiKey);
    }
    throw error;
  }
};

const EQUIPMENT_TOKENS = [
  'barra',
  'mancuerna',
  'mancuernas',
  'cable',
  'máquina',
  'maquina',
  'smith',
  'banda',
  'bandas',
  'polea',
  'kettlebell',
  'peso corporal',
  'bodyweight'
];

const buildCandidates = (names: string[]) => {
  const candidates = new Set<string>();
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      candidates.add(name);
      const withoutParens = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if (withoutParens) candidates.add(withoutParens);
      let cleaned = normalizeName(withoutParens);
      EQUIPMENT_TOKENS.forEach((token) => {
        cleaned = cleaned.replace(new RegExp(`\\b${normalizeName(token)}\\b`, 'g'), '');
      });
      const compact = cleaned.replace(/\s+/g, ' ').trim();
      if (compact && compact.length > 2) {
        candidates.add(compact);
        const tokens = compact.split(' ');
        if (tokens.length >= 3) {
          candidates.add(tokens.slice(-3).join(' '));
        }
        if (tokens.length >= 2) {
          candidates.add(tokens.slice(-2).join(' '));
        }
      }
    });
  return Array.from(candidates).slice(0, 6);
};

const getQueryResults = (data: any) => {
  const raw: unknown = data?.exercises ?? data?.exerciseIds ?? data?.results ?? data?.data ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) =>
      typeof item === 'string'
        ? { id: item, exerciseId: item, name: item, displayName: item, aliases: [] }
        : item
    )
    .filter(Boolean) as Array<{
    id?: string;
    exerciseId?: string;
    displayName?: string;
    name?: string;
    aliases?: string[];
  }>;
};

const findWrkoutMatch = async (names: string[], apiKey?: string) => {
  const candidates = buildCandidates(names);
  for (const candidate of candidates) {
    const params = new URLSearchParams({
      name: candidate,
      limit: '25',
      lang: 'en-GB',
      searchlang: 'en-GB'
    });
    const data = await fetchWrkout(`/exercise/query?${params.toString()}`, apiKey);
    const results = getQueryResults(data);
    if (!Array.isArray(results) || results.length === 0) {
      continue;
    }
    let best = results[0];
    let bestScore = Number.POSITIVE_INFINITY;
    results.forEach((item) => {
      const options = [item.displayName, item.name, ...(item.aliases ?? [])].filter(
        (option): option is string => typeof option === 'string' && option.trim().length > 0
      );
      const score = options.length
        ? Math.min(...options.map((option) => scoreCandidate(candidate, option)))
        : Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    });
    return best?.id ?? best?.exerciseId ?? null;
  }
  return null;
};

export async function getWrkoutTips(
  exerciseId: string,
  exerciseNames: string[],
  apiKey?: string
): Promise<{ record: WrkoutTipRecord | null; status: WrkoutStatus }> {
  const cached = await db.wrkoutTips.get(exerciseId);
  if (cached && !isExpired(cached.lastFetchedAt)) {
    const hasTips = Boolean(cached.summary) || (cached.bullets?.length ?? 0) > 0;
    if (hasTips) {
      return { record: cached, status: 'ok' };
    }
    if (cached.wrkoutId) {
      return { record: cached, status: 'missing' };
    }
    // Retry unresolved misses (no wrkoutId) to recover from better matching/proxy changes.
  }
  try {
    const wrkoutId = await findWrkoutMatch(exerciseNames, apiKey);
    if (!wrkoutId) {
      const record = {
        exerciseId,
        lastFetchedAt: new Date().toISOString(),
        bullets: [],
        summary: undefined
      };
      await db.wrkoutTips.put(record);
      return { record, status: 'missing' };
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
    const hasTips = Boolean(record.summary) || (record.bullets?.length ?? 0) > 0;
    return { record, status: hasTips ? 'ok' : 'missing' };
  } catch (error) {
    if (cached) {
      const hasTips = Boolean(cached.summary) || (cached.bullets?.length ?? 0) > 0;
      return { record: cached, status: hasTips ? 'ok' : 'missing' };
    }
    const code = (error as Error & { code?: WrkoutErrorCode }).code;
    if (code === 'auth') return { record: null, status: 'auth' };
    if (code === 'config') return { record: null, status: 'config' };
    return { record: null, status: 'error' };
  }
}
