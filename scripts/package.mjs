import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Validator } from '@cfworker/json-schema';
import { root, prepareDestination, copyDistribution, writeInventory } from './distribution.mjs';

const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'));
const mcp = JSON.parse(await readFile(join(root, 'mcp.json'), 'utf8'));
const compatibility = { name: manifest.name, version: manifest.version, description: manifest.description, author: manifest.author, license: manifest.license, keywords: manifest.keywords, skills: './skills/', mcpServers: './mcp.json', interface: manifest.extensions['com.openai'].interface };
for (const [name, data] of [['plugin', manifest], ['mcp', mcp]]) {
  const schema = JSON.parse(await readFile(join(root, 'schemas', `${name}.schema.json`), 'utf8'));
  const validation = new Validator(schema).validate(data);
  if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
}
if ([...manifest.extensions['com.openai'].interface.shortDescription].length > 30) throw new Error('Listing subtitle too long');
// Fail before touching the previous distribution if build artifacts are missing.
for (const file of ['dist/viewer.html', 'server/index.bundle.mjs', 'server/preview.bundle.mjs']) await readFile(join(root, file));
await mkdir(join(root, '.codex-plugin'), { recursive: true });
await writeFile(join(root, '.codex-plugin/plugin.json'), JSON.stringify(compatibility, null, 2) + '\n');

const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
let notices = '# Third-party notices\n\nThis distribution bundles code from the following libraries. Development dependencies are listed for source reproducibility.\n\n## Agent Plugins schemas 1.0.0\n\nThe unmodified schemas in `schemas/` are Apache-2.0 licensed. See `schemas/README.md` for source attribution and `schemas/LICENSE` for the full license.\n';
for (const path of Object.keys(lock.packages).sort()) {
  if (!path.startsWith('node_modules/')) continue;
  let pkg;
  try { pkg = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && lock.packages[path].optional) continue; throw error; }
  notices += `\n## ${pkg.name} ${pkg.version}\n\nLicense: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license)}\n`;
  for (const name of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE-MIT', 'COPYING']) {
    try { notices += '\n' + await readFile(join(root, path, name), 'utf8') + '\n'; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), notices.replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, ''));
const destination = await prepareDestination('blend-studio');
await copyDistribution(destination, { bundled: true });
const files = await writeInventory('blend-studio', destination, { name: manifest.name, version: manifest.version, validatedSchemas: true });
console.log(`Bundled distribution: ${destination}\n${files.length} files; manifest schemas passed.`);
