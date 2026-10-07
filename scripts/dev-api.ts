/**
 * `npm run dev:api`: runs the API with `tsx watch` and ALSO restarts it when .env or
 * .env.local change. tsx's own watcher always ignores dotfiles (even with --include),
 * and env vars are only read at process start, so without this a new SMTP_PASS etc.
 * would be silently ignored until a manual restart.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { watchFile, type Stats } from 'node:fs';

const ENV_FILES = ['.env', '.env.local'];
const TSX_ARGS = ['watch', '--clear-screen=false', 'server/dev.ts'];

let child: ChildProcess | null = null;
let restarting = false;
let shuttingDown = false;

function start() {
  child = spawn(process.execPath, [tsxCli(), ...TSX_ARGS], { stdio: 'inherit', env: process.env });
  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;
    if (restarting) {
      restarting = false;
      start();
      return;
    }
    // tsx watch only exits on its own after a fatal error; mirror that.
    process.exit(code ?? (signal ? 1 : 0));
  });
}

function tsxCli(): string {
  return new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url).pathname;
}

let timer: NodeJS.Timeout | null = null;
function restart(file: string) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\n  ♻️  ${file} changed, restarting API so new environment variables apply…\n`);
    if (!child) return start();
    restarting = true;
    child.kill('SIGTERM');
  }, 300);
}

for (const file of ENV_FILES) {
  // Polling copes with editors that save by replacing the file, and with files created later.
  watchFile(file, { interval: 500 }, (curr: Stats, prev: Stats) => {
    if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) restart(file);
  });
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    shuttingDown = true;
    if (child) child.kill(sig);
    else process.exit(0);
    child?.on('exit', () => process.exit(0));
  });
}

start();
