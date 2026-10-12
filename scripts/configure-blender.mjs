import { configureBlender, blenderStatus } from '../server/settings.mjs';
try {
  if (process.argv[2] !== undefined) await configureBlender(process.argv[2]);
  console.log(JSON.stringify(await blenderStatus()));
} catch (error) { console.error(error.message); process.exitCode = 1; }
