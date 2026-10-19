import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, validateTargetUrl } from '../src/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parses init arguments and options', () => {
  assert.deepEqual(parseArgs(['init', 'https://example.com', '--dir', './out', '--name', 'Example Site']), {
    command: 'init',
    positionals: ['https://example.com'],
    options: { dir: './out', name: 'Example Site' },
  });
});

test('accepts ordinary HTTP and HTTPS targets', () => {
  assert.equal(validateTargetUrl('https://example.com/a').hostname, 'example.com');
  assert.equal(validateTargetUrl('http://localhost:3000').protocol, 'http:');
});

test('rejects unsupported protocols and credential-bearing URLs', () => {
  assert.throws(() => validateTargetUrl('file:///etc/passwd'), /Only http/);
  assert.throws(() => validateTargetUrl('https://user:password@example.com'), /credentials/);
  assert.throws(() => validateTargetUrl('not a URL'), /valid absolute URL/);
});

test('initializes a workspace with both WRECK handoff artifacts', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'wreck-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const destination = path.join(temp, 'generated-app');
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'src', 'cli.mjs'), 'init', 'https://example.com/product',
    '--dir', destination, '--name', 'Sample Product',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WRECK workspace created/);
  const config = JSON.parse(await fs.readFile(path.join(destination, 'wreck.config.json'), 'utf8'));
  assert.equal(config.target, 'https://example.com/product');
  assert.deepEqual(config.workflow, ['scope-planner', 'rea-investigator', 'experience-mapper', 'implementation-builder', 'quality-reviewer']);
  const spec = await fs.readFile(path.join(destination, 'docs/research/wreck/SPEC.md'), 'utf8');
  assert.match(spec, /Evidence standard/);
  assert.match(spec, /not investigated yet/);
  const plan = await fs.readFile(path.join(destination, 'docs/research/wreck/RUN-PLAN.md'), 'utf8');
  assert.match(plan, /REA Investigator/);
  assert.match(plan, /Map → Observe → Build → Compare/);
  await assert.rejects(fs.access(path.join(destination, '.git')));
  await assert.rejects(fs.access(path.join(destination, 'node_modules')));
});

test('does not overwrite a non-empty destination', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'wreck-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const destination = path.join(temp, 'keep');
  await fs.mkdir(destination);
  await fs.writeFile(path.join(destination, 'important.txt'), 'keep');
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'src', 'cli.mjs'), 'init', 'https://example.com', '--dir', destination,
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not empty/);
  assert.equal(await fs.readFile(path.join(destination, 'important.txt'), 'utf8'), 'keep');
});
