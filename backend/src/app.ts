import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { ApiError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { validatorCompiler } from './validation.js';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Tokens and session cookies never reach the logs.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);

  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
  });

  app.setErrorHandler((err: FastifyError | ApiError, request, reply) => {
    if (err instanceof ApiError) {
      if (err.retryAfter !== undefined) reply.header('Retry-After', String(err.retryAfter));
      return reply.status(err.statusCode).send(err.toBody());
    }

    if ('validation' in err && err.validation) {
      const fields = err.validation.map((v) => {
        const path = v.instancePath.replace(/^\//, '').replaceAll('/', '.');
        const missing = v.params['missingProperty'];
        return [path, typeof missing === 'string' ? missing : ''].filter(Boolean).join('.') || 'body';
      });
      const body = new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields }).toBody();
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
    async (_api) => {
      // e.g. await api.register(sessionRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
