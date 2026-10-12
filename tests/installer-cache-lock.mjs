// Run explicitly with a packaged plugin and desktop CLI; never mutate a user's configuration.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const cli = process.argv[3];
assert.ok(cli, 'Pass the desktop Codex executable as the second argument.');
const suite = join(tmpdir(), `blend-studio-cache-lock-${Date.now()}`);
const distribution = join(suite, '配布 O\'Neil'), base = join(suite, 'app'), config = join(suite, 'config');
const version = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')).version;
await mkdir(suite, { recursive: true });
await cp(source, distribution, { recursive: true, filter: path => !path.includes('node_modules') });
await mkdir(base, { recursive: true });
await mkdir(config, { recursive: true });
await writeFile(join(config, 'config.toml'), '[plugins."unrelated@example"]\nenabled = false\n');
await writeFile(join(base, 'settings.json'), '{"preserveInstallerTest":"keep"}\n');

function run(executable, args) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { cwd: suite, windowsHide: true, env: { ...process.env, CODEX_HOME: config, BLEND_STUDIO_CONFIG_DIR: base } });
    let output = '', error = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Installer check timed out')); }, 120000);
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => error += data);
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); accept({ code, output, error }); });
  });
}
function install() {
  return run('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', join(distribution, 'Install-Blend-Studio.ps1'), '-Headless', '-InstallBase', base, '-ConfigurationHome', config, '-CodexPath', cli]);
}
function result(response) {
  assert.equal(response.code, 0, response.error + response.output);
  return JSON.parse(response.output.replace(/^\uFEFF/, ''));
}

const first = result(await install());
assert.equal(first.version, version);
assert.equal(first.reusedInstallation, false);
assert.equal(first.hostVerified, true);
// A live MCP process holds its working directory on Windows, just as the host does.
const locked = spawn(process.execPath, [join(first.installedPath, 'server', 'index.bundle.mjs')], { cwd: first.installedPath, windowsHide: true, env: { ...process.env, BLEND_STUDIO_CONFIG_DIR: base }, stdio: ['pipe', 'ignore', 'ignore'] });
await once(locked, 'spawn');
const checks = [];
try {
  const original = await run(cli, ['plugin', 'add', 'blend-studio@blend-studio-local', '--json']);
  assert.notEqual(original.code, 0, 'The fixture must reproduce the original Windows lock.');
  assert.match(original.error, /failed to back up plugin cache entry/);
  checks.push('Original cache backup error reproduced with a live MCP process');

  const repeated = result(await install());
  assert.equal(repeated.reusedInstallation, true);
  assert.equal(repeated.installedPath, first.installedPath);
  assert.equal(repeated.hostVerified, true);
  assert.equal(locked.exitCode, null, 'The installer must leave the live MCP process running.');
  assert.match(await readFile(join(config, 'config.toml'), 'utf8'), /unrelated@example/);
  assert.equal(JSON.parse(await readFile(join(base, 'settings.json'), 'utf8')).preserveInstallerTest, 'keep');
  checks.push('Same package succeeds while in use; live process and existing settings preserved');

  // Modify the source rather than the installed cache to exercise a real replacement.
  await writeFile(join(distribution, 'README.md'), (await readFile(join(distribution, 'README.md'), 'utf8')) + '\nCache-lock test source change.\n');
  const replacement = await install();
  assert.equal(replacement.code, 1);
  assert.match(replacement.error, /完全に終了/);
  assert.match(replacement.error, /もう一度試す/);
  assert.equal(locked.exitCode, null);
  checks.push('Changed package is not incorrectly accepted; locked replacement explains recovery');
} finally {
  const exited = once(locked, 'exit');
  locked.kill();
  await exited;
}
const repaired = result(await install());
assert.equal(repaired.reusedInstallation, false);
assert.equal(repaired.hostVerified, true);
assert.match(await readFile(join(repaired.installedPath, 'README.md'), 'utf8'), /Cache-lock test source change/);
checks.push('Replacement succeeds after the test MCP process is closed');
console.log(JSON.stringify({ version, passed: checks, testHome: suite }, null, 2));
