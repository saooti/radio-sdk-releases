import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = process.argv[2];
if (!source || path.extname(source) !== '.tgz') {
  throw new Error('Usage : npm run sdk:install -- /chemin/vers/archive-sdk.tgz');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const input = path.resolve(source);
if (!(await stat(input)).isFile()) throw new Error('L’archive SDK doit être un fichier.');
const vendor = path.join(root, 'vendor');
const hash = createHash('sha256').update(await readFile(input)).digest('hex').slice(0, 12);
const filename = `saooti-radio-sdk-${hash}.tgz`;
const destination = path.join(vendor, filename);
await mkdir(vendor, { recursive: true });
if (input !== destination) await copyFile(input, destination);
const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
pkg.dependencies['@saooti/radio-sdk'] = 'file:vendor/' + filename;
await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');

// Reuse the active npm CLI, including on Windows, without a shell.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Lancer ce script via npm run sdk:install.');
const result = spawnSync(process.execPath, [npmCli, 'install', '--no-fund'], {
  cwd: root, stdio: 'inherit', windowsHide: true
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
