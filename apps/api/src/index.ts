import { createApp } from './server.js';
import { config } from './config.js';
import { runMigrations } from './migrations.js';

const port = config.PORT;
const { httpServer } = createApp();

async function start() {
  if (config.AUTO_RUN_MIGRATIONS && config.DATABASE_URL) {
    await runMigrations();
  }

  httpServer.listen(port, () => {
     
    console.log(`API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
   
  console.error('Failed to start API:', error);
  process.exit(1);
});
