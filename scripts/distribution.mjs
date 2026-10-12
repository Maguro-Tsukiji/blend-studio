import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const releaseRoot = join(root, 'release');
const common = [
  'plugin.json', 'mcp.json', 'package.json', 'package-lock.json',
  'README.md', 'README.en.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
  'CONTRIBUTING.md', 'CHANGELOG.md', 'SECURITY.md', '.gitignore', '.gitattributes',
  'Start-Preview.ps1', 'Install-Blend-Studio.cmd', 'Install-Blend-Studio.ps1',
  '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json',
  '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/config.yml', '.github/pull_request_template.md', '.github/workflows/ci.yml',
  'docs/ADAPTERS.md', 'docs/INSTALLATION.md', 'docs/PUBLISHING.md', 'docs/images/surface-point.png',
  'skills/blend-studio/SKILL.md',
  'schemas/plugin.schema.json', 'schemas/mcp.schema.json', 'schemas/LICENSE', 'schemas/README.md',
  'assets/logo.svg', 'assets/studio-companion.glb', 'assets/demo-base64.json',
  'assets/textured-test.blend', 'assets/README.md',
];

// Only regenerate these known build directories, never an arbitrary argument.
export async function prepareDestination(name) {
  if (!['blend-studio', 'blend-studio-source'].includes(name)) throw new Error('Unknown distribution directory');
  const destination = resolve(releaseRoot, name);
  if (dirname(destination) !== resolve(releaseRoot) || basename(destination) !== name) throw new Error('Unsafe output path');
  await mkdir(releaseRoot, { recursive: true });
  if ((await lstat(releaseRoot)).isSymbolicLink() || await realpath(releaseRoot) !== resolve(releaseRoot)) throw new Error('Release directory must not be a symbolic link');
  try {
    const info = await lstat(destination);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(destination) !== destination) throw new Error('Unsafe existing output directory');
    await rm(destination, { recursive: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(destination);
  return destination;
}

export async function copyDistribution(destination, { bundled = false } = {}) {
  const files = [...common];
  for (const directory of ['src', 'server', 'scripts', 'tests']) {
    for (const name of await readdir(join(root, directory))) {
      if (!/\.(mjs|html|css|ps1|py)$/.test(name)) continue;
      if (!bundled && name.endsWith('.bundle.mjs')) continue;
      files.push(`${directory}/${name}`);
    }
  }
  if (bundled) files.push('dist/viewer.html');
  for (const relative of files) {
    const source = join(root, relative);
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Distribution requires a regular file: ${relative}`);
    const target = join(destination, relative);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);
  }
}

export async function inventory(directory) {
  const files = [];
  async function walk(relative = '') {
    for (const name of (await readdir(join(directory, relative))).sort()) {
      const path = relative ? `${relative}/${name}` : name;
      const info = await lstat(join(directory, path));
      if (info.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${path}`);
      if (info.isDirectory()) await walk(path);
      else files.push({ path, bytes: info.size, sha256: createHash('sha256').update(await readFile(join(directory, path))).digest('hex') });
    }
  }
  await walk();
  return files;
}

export async function writeInventory(name, directory, metadata = {}) {
  const files = await inventory(directory);
  await writeFile(join(releaseRoot, `${name}-manifest.json`), JSON.stringify({ ...metadata, files }, null, 2) + '\n');
  return files;
}
