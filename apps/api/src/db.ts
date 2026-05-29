import { config } from './config.js';

let mod;
if (config.DATABASE_URL) {
   
  mod = await import('./db-pg.js');
} else {
   
  mod = await import('./db-file.js');
}

export const database: any = mod.database;
export const initializeSeedData: any = mod.initializeSeedData;
export const attachmentsDir: any = mod.attachmentsDir;
