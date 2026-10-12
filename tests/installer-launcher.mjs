// Exercise the actual .cmd entrypoint, including failures before PowerShell starts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const source = resolve(process.argv[2]);
const cli = process.argv[3];
assert.ok(cli, 'Pass the packaged plugin and desktop Codex executable.');
const suite = join(tmpdir(), `blend-studio-launcher-${Date.now()}`);
const distribution = join(suite, "配布 & O'Neil !"), base = join(suite, 'app'), config = join(suite, 'config');
const manifest = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
await mkdir(suite, { recursive: true });
await cp(source, distribution, { recursive: true });
function runLauncher(root) {
  return new Promise((accept, reject) => {
    const command = '""%BLEND_STUDIO_TEST_LAUNCHER%" -InstallBase "%BLEND_STUDIO_TEST_BASE%" -ConfigurationHome "%BLEND_STUDIO_TEST_CONFIG%" -CodexPath "%BLEND_STUDIO_TEST_CLI%""';
    const child = spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', command], {
      cwd: suite, windowsHide: true, windowsVerbatimArguments: true,
      env: { ...process.env, BLEND_STUDIO_NO_PAUSE: '1', BLEND_STUDIO_TEST_LAUNCHER: join(root, 'Install-Blend-Studio.cmd'), BLEND_STUDIO_TEST_BASE: base, BLEND_STUDIO_TEST_CONFIG: config, BLEND_STUDIO_TEST_CLI: cli },
    });
    let output = '', error = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Launcher timed out')); }, 120000);
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => error += data);
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); accept({ code, output, error }); });
  });
}
const checks = [];
const first = await runLauncher(distribution);
assert.equal(first.code, 0, first.error + first.output);
assert.match(first.output, /Blend Studio/);
assert.match(first.output, /必要なソフトと設定を確認/);
assert.ok(first.output.includes(`完了：Blend Studio ${manifest.version}`));
const installed = JSON.parse(await readFile(join(base, 'installation.json'), 'utf8'));
assert.equal(installed.hostVerified, true);
assert.equal(installed.version, manifest.version);
assert.match(await readFile(join(base, 'installer.log'), 'utf8'), /完了：Blend Studio/);
checks.push('Actual cmd automatically installs, displays progress and completion, and writes a log');

const repeated = await runLauncher(distribution);
assert.equal(repeated.code, 0, repeated.error + repeated.output);
assert.match(repeated.output, /同じ版が正常にインストール/);
checks.push('Actual cmd repeated installation succeeds');

const missing = join(suite, 'cmd-only');
await mkdir(missing);
await cp(join(source, 'Install-Blend-Studio.cmd'), join(missing, 'Install-Blend-Studio.cmd'));
const incomplete = await runLauncher(missing);
assert.equal(incomplete.code, 1);
assert.match(incomplete.output, /すべて展開/);
checks.push('Cmd-only extraction explains how to extract the whole ZIP');

const invalid = join(suite, 'broken-script');
await cp(source, invalid, { recursive: true });
await writeFile(join(invalid, 'Install-Blend-Studio.ps1'), '\ufeffparam(\n', 'utf8');
const parseFailure = await runLauncher(invalid);
assert.notEqual(parseFailure.code, 0);
assert.match(parseFailure.output, /Setup did not finish/);
assert.ok(parseFailure.error.length > 0, 'PowerShell startup errors must remain visible.');
checks.push('PowerShell parse failure returns an error with visible details');
console.log(JSON.stringify({ version: manifest.version, passed: checks, testHome: suite }, null, 2));
