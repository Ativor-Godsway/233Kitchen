/** Tiny interactive prompts for CLI scripts (stdin must be a terminal). */
import { createInterface } from 'node:readline';

function requireTty() {
  if (!process.stdin.isTTY) {
    throw new Error('This command is interactive: run it in a terminal (stdin is not a TTY).');
  }
}

/** Asks a question and resolves with the trimmed answer. */
export function ask(question: string): Promise<string> {
  requireTty();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

/**
 * Asks for a secret without echoing it. Nothing typed is printed, logged or kept in shell history.
 */
export function askHidden(question: string): Promise<string> {
  requireTty();
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = (err?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (err) reject(err);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return done();
        if (ch === '\u0003') return done(new Error('Cancelled'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}
