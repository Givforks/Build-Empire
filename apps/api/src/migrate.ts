import { runMigrations } from './migrations.js';

runMigrations()
  .then(() => {
     
    console.log('Migrations applied successfully.');
  })
  .catch((error) => {
     
    console.error(error);
    process.exit(1);
  });
