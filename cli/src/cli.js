import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export async function run(argv, io) {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check\n`);
  return 1;
}
