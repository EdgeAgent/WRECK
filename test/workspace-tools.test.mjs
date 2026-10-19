import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkspaceTools } from '../src/tools/workspace.mjs';

test('workspace tools are read-only by default and deny secret/escape paths', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wreck-tools-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'README.md'), 'hello');
  await fs.writeFile(path.join(root, '.env'), 'do-not-read');
  const tools = createWorkspaceTools(root);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  assert.equal(await byName.workspace_read_file.execute({ path: 'README.md' }), 'hello');
  assert.equal(byName.workspace_write_file, undefined);
  await assert.rejects(byName.workspace_read_file.execute({ path: '../outside.txt' }), /inside the workspace/);
  await assert.rejects(byName.workspace_read_file.execute({ path: '.env' }), /secret files/);
});

test('workspace writes are added only when explicitly enabled', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wreck-tools-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tools = createWorkspaceTools(root, { allowWrite: true });
  const writer = tools.find((tool) => tool.name === 'workspace_write_file');
  assert.ok(writer);
  const result = await writer.execute({ path: 'src/generated.js', content: 'export default true;\n' });
  assert.equal(result.written, path.join('src', 'generated.js'));
  assert.equal(await fs.readFile(path.join(root, 'src/generated.js'), 'utf8'), 'export default true;\n');
  await assert.rejects(writer.execute({ path: '.env.production', content: 'secret' }), /secret files/);
});
