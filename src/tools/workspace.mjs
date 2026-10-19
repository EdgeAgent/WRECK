import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HIDDEN = new Set(['.git', 'node_modules', '.next', 'coverage', '.turbo']);
const BLOCKED_FILES = new Set(['.env', '.env.local', '.env.production', '.env.development']);

async function safePath(root, input) {
  const target = path.resolve(root, input);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path must identify a file inside the workspace.');
  if (relative.split(path.sep).some((part) => HIDDEN.has(part) || part === '..')) throw new Error('Access to dependency, build, or Git metadata paths is denied.');
  if (relative.split(path.sep).some((part) => BLOCKED_FILES.has(part) || part.startsWith('.env.'))) throw new Error('Access to environment/secret files is denied.');
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symbolic-link paths are denied.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

export function createWorkspaceTools(workspace, { allowWrite = false, allowCheck = false, checkTimeoutMs = 180_000 } = {}) {
  const root = path.resolve(workspace);
  const tools = [
    {
      name: 'workspace_list_files',
      description: 'List project files relative to the workspace, excluding Git metadata, dependencies, and build output.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative directory; defaults to project root.' } }, additionalProperties: false },
      async execute({ path: requested = '.' } = {}) {
        const dir = requested === '.' ? root : await safePath(root, requested);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter((entry) => !HIDDEN.has(entry.name) && !entry.name.startsWith('.env'))
          .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
      },
    },
    {
      name: 'workspace_read_file',
      description: 'Read a UTF-8 text file within the project (maximum 100 KB). Secret and generated files are blocked.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
      async execute({ path: requested }) {
        const file = await safePath(root, requested);
        const stat = await fs.stat(file);
        if (!stat.isFile() || stat.size > 100_000) throw new Error('Only regular text files up to 100 KB can be read.');
        return fs.readFile(file, 'utf8');
      },
    },
  ];
  if (allowWrite) tools.push({
    name: 'workspace_write_file',
    description: 'Write or replace a UTF-8 project file. Available only when the user starts the agent with --allow-write.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false },
    async execute({ path: requested, content }) {
      if (typeof content !== 'string' || Buffer.byteLength(content) > 100_000) throw new Error('File content must be text no larger than 100 KB.');
      const file = await safePath(root, requested);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, { encoding: 'utf8', flag: 'w' });
      return { written: path.relative(root, file), bytes: Buffer.byteLength(content) };
    },
  });
  if (allowCheck) tools.push({
    name: 'workspace_run_check',
    description: 'Run the fixed command npm run check in this workspace. Available only with --allow-check.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      return new Promise((resolve, reject) => {
        const child = spawn('npm', ['run', 'check'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
        let output = '';
        const collect = (chunk) => { output = `${output}${chunk}`.slice(-40_000); };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        const timer = setTimeout(() => child.kill('SIGTERM'), checkTimeoutMs);
        child.on('error', (error) => { clearTimeout(timer); reject(error); });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code, output: output || '[no output]' });
        });
      });
    },
  });
  return tools;
}
