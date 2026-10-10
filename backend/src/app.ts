import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Deps } from './deps.js';
import { ApiError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { explanationRoutes } from './routes/explanations.js';
import { instrumentRoutes } from './routes/instruments.js';
import { interpretationRoutes } from './routes/interpretations.js';
import { planRoutes } from './routes/plans.js';
import { proposalRoutes } from './routes/proposals.js';
import { sessionRoutes } from './routes/session.js';
import { thesisRoutes } from './routes/theses.js';
import { validatorCompiler } from './validation.js';

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Tokens and session cookies never reach the logs.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' && hasPrettyLogs() && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.decorate('deps', deps);
  // Without a listener ioredis prints every reconnect failure as an unhandled error.
  deps.redis?.on('error', (err: Error) => app.log.warn({ err }, 'redis unavailable'));
  app.addHook('onClose', async () => {
    await deps.close?.();
  });

  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH'],
  });

  // Production requires SESSION_SECRET (see config.ts). Locally an empty one gets a random
  // secret per process, so anonymous sessions just reset on restart.
  const cookieSecret = config.SESSION_SECRET || randomBytes(32).toString('base64url');
  await app.register(cookie, { secret: cookieSecret });

  app.setErrorHandler((err: FastifyError | ApiError, request, reply) => {
    if (err instanceof ApiError) {
      if (err.retryAfter !== undefined) reply.header('Retry-After', String(err.retryAfter));
      return reply.status(err.statusCode).send(err.toBody());
    }

    if ('validation' in err && err.validation) {
      const fields = err.validation.map((v) => {
        const path = v.instancePath.replace(/^\//, '').replaceAll('/', '.');
        // A missing or unknown discriminator (e.g. `source`) points at the tag itself.
        const missing = v.keyword === 'discriminator' ? v.params['tag'] : v.params['missingProperty'];
        return [path, typeof missing === 'string' ? missing : ''].filter(Boolean).join('.') || 'body';
      });
      // One field can fail several keywords (e.g. `required` and `discriminator`): list it once.
      const body = new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: [...new Set(fields)] }).toBody();
      return reply.status(400).send(body);
    }

    // Fastify's own client errors (malformed JSON, __proto__ in the body, unsupported content type,
    // body too large): keep the status, never echo Fastify's message.
    const status = 'statusCode' in err ? err.statusCode : undefined;
    if (status !== undefined && status >= 400 && status < 500) {
      const body = new ApiError(status, 'VALIDATION_ERROR', 'The request body is invalid.').toBody();
      return reply.status(status).send(body);
    }

    request.log.error({ err }, 'unhandled error');
    const body = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.').toBody();
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(new ApiError(404, 'NOT_FOUND', 'Not found.').toBody());
  });

  // Liveness probe for Docker; outside the versioned API.
  await app.register(healthRoutes);

  // Contract routes (Docs/api/openapi.yaml) go under this prefix.
  await app.register(
    async (api) => {
      await api.register(sessionRoutes);
      await api.register(thesisRoutes);
      await api.register(interpretationRoutes);
      await api.register(proposalRoutes);
      await api.register(explanationRoutes);
      await api.register(instrumentRoutes);
      await api.register(planRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

// pino-pretty is a dev dependency: present with `npm run dev`, pruned from the Docker image. Without
// it, development logs stay JSON instead of crashing the server at startup.
function hasPrettyLogs(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}
