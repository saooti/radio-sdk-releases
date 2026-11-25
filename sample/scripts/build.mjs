import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await build({
  absWorkingDir: root, entryPoints: ['src/preload.mjs'], outfile: 'dist/preload.cjs',
  bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron']
});
await build({
  absWorkingDir: root, entryPoints: ['src/renderer.mjs'], outfile: 'dist/renderer.js',
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', sourcemap: true
});
for (const name of ['index.html', 'styles.css']) {
  await cp(new URL('../src/' + name, import.meta.url), new URL('../dist/' + name, import.meta.url));
}
console.log('Renderer et preload compilés depuis le paquet npm du SDK.');
