import { prepareDestination, copyDistribution, writeInventory } from './distribution.mjs';

const destination = await prepareDestination('blend-studio-source');
await copyDistribution(destination);
const files = await writeInventory('blend-studio-source', destination, { kind: 'source' });
console.log(`Clean source: ${destination}\n${files.length} files; generated bundles and local reports excluded.`);
