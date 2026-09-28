import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDeps } from './deps.js';

const config = loadConfig();
const app = await buildApp(createDeps(config));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: '0.0.0.0', port: config.PORT });
} catch (err) {
  app.log.fatal({ err }, 'failed to start');
  process.exit(1);
}
