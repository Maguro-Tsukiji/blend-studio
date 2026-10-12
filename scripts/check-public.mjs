import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { releaseRoot, inventory } from './distribution.mjs';

const directory = join(releaseRoot, 'blend-studio-source');
const files = await inventory(directory);
const names = new Set(files.map(file => file.path));
for (const required of ['README.md', 'README.en.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', '.gitignore', 'schemas/LICENSE', 'docs/images/surface-point.png']) assert.ok(names.has(required), `Missing ${required}`);
for (const { path } of files) {
  assert.ok(!/(^|\/)(node_modules|dist|release|\.git)(\/|$)|\.bundle\.mjs$|(?:-result\.json|-failure\.png|\.log|\.blend[12])$|(^|\/)(settings|installation)\.json$|(^|\/)\.env(?:\.|$)/.test(path), `Unwanted public file: ${path}`);
  if (!/\.(md|mjs|json|html|css|ps1|cmd|py|yml)$/.test(path)) continue;
  const content = await readFile(join(directory, path), 'utf8');
  assert.ok(!/[A-Za-z]:[\\/]Users[\\/][^%\s\\/]+[\\/]|\/home\/[^$\s/]+\//i.test(content), `Personal absolute path in ${path}`);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}/.test(content), `Credential-like content in ${path}`);
  if (path.endsWith('.md')) {
    for (const match of content.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
      const link = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link)) continue;
      const target = resolve(dirname(join(directory, path)), decodeURIComponent(link.split('#')[0]));
      assert.ok(!relative(directory, target).startsWith('..'), `Escaping Markdown link in ${path}: ${link}`);
      assert.ok((await stat(target)).isFile(), `Broken Markdown link in ${path}: ${link}`);
    }
  }
}
console.log(`Public source checks passed: ${files.length} files, local documentation links, required notices, and common private-file/credential patterns. Review binary asset rights separately.`);
