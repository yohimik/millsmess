import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { root } from './model.mjs';
try { execFileSync(process.env.GO || 'go', ['test', './...'], { cwd:join(root,'generated/go'),stdio:'inherit' }); }
catch(error) {
  if(error.code === 'ENOENT') console.error('Go is required for binding verification. Install Go >=1.24 and put go on PATH, or set GO to its executable.');
  process.exitCode=1;
}
