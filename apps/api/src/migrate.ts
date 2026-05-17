import { runMigrations } from './migrations.js';

runMigrations()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Migrations applied successfully.');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
