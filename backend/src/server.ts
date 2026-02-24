import 'dotenv/config';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';

const WRKOUT_BASE_URL = 'https://api.wrkout.xyz';
const API_PORT = Number(process.env.API_PORT || 8787);
const API_HOST = process.env.API_HOST || '0.0.0.0';

const app = Fastify({ logger: true });

type QueryRequest = {
  Querystring: {
    name?: string;
    limit?: string;
    lang?: string;
    searchlang?: string;
  };
};

type ExerciseParams = {
  Params: {
    exerciseId: string;
  };
  Querystring: {
    lang?: string;
  };
};

function getWrkoutApiKey() {
  return process.env.WRKOUT_API_KEY?.trim() || '';
}

async function proxyWrkout(path: string) {
  const apiKey = getWrkoutApiKey();
  if (!apiKey) {
    return {
      statusCode: 503,
      payload: { error: 'missing_wrkout_api_key' as const }
    };
  }

  const response = await fetch(`${WRKOUT_BASE_URL}${path}`, {
    headers: {
      'X-API-Key': apiKey
    }
  });

  const contentType = response.headers.get('content-type') || 'application/json';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return {
      statusCode: response.status,
      payload: data
    };
  }

  const text = await response.text();
  return {
    statusCode: response.status,
    payload: { raw: text }
  };
}

async function bootstrap() {
  await app.register(cors, {
    origin: true
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'gym-app-api'
  }));

  const queryHandler = async (request: FastifyRequest<QueryRequest>, reply: FastifyReply) => {
    const name = (request.query.name || '').trim();
    if (!name) {
      reply.code(400);
      return { error: 'name_required' };
    }

    const params = new URLSearchParams({
      name,
      limit: request.query.limit || '25',
      lang: request.query.lang || 'en-GB',
      searchlang: request.query.searchlang || 'en-GB'
    });

    try {
      const proxied = await proxyWrkout(`/exercise/query?${params.toString()}`);
      reply.code(proxied.statusCode);
      return proxied.payload;
    } catch (error) {
      request.log.error({ error }, 'wrkout-query-failed');
      reply.code(502);
      return { error: 'wrkout_unavailable' };
    }
  };

  app.get<QueryRequest>('/api/wrkout/query', queryHandler);
  app.get<QueryRequest>('/api/wrkout/exercise/query', queryHandler);

  app.get<ExerciseParams>('/api/wrkout/exercise/:exerciseId', async (request, reply) => {
    const exerciseId = request.params.exerciseId;
    if (!exerciseId) {
      reply.code(400);
      return { error: 'exercise_id_required' };
    }

    const lang = request.query.lang || 'en-GB';
    try {
      const proxied = await proxyWrkout(
        `/exercise/${encodeURIComponent(exerciseId)}?lang=${encodeURIComponent(lang)}`
      );
      reply.code(proxied.statusCode);
      return proxied.payload;
    } catch (error) {
      request.log.error({ error }, 'wrkout-detail-failed');
      reply.code(502);
      return { error: 'wrkout_unavailable' };
    }
  });

  await app.listen({ host: API_HOST, port: API_PORT });
}

void bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
