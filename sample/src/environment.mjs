import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

// Explicit files must exist; the optional development .env is never packaged.
export function sampleEnvironment(args = [], env = process.env) {
  const configured = args.find(argument => argument.startsWith('--config='))?.slice('--config='.length) ?? env.SAOOTI_RADIO_CONFIG;
  if (configured !== undefined && !configured.trim()) throw new Error('Chemin de configuration vide.');
  const file = configured === undefined ? new URL('../.env', import.meta.url) : path.resolve(configured);
  if (configured === undefined && !existsSync(file)) return env;
  return { ...parseEnv(readFileSync(file, 'utf8')), ...env };
}
