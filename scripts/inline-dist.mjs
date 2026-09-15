import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync('dist/index.html', 'utf8');

// Inline every emitted JS chunk.
let out = html.replace(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) => {
    const code = readFileSync(join('dist', src), 'utf8').replaceAll('</script>', '<\\/script>');
    return `<script type="module">\n${code}\n</script>`;
  },
);

// Inline stylesheets.
out = out.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = readFileSync(join('dist', href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// Favicon becomes a data URI so the single file carries it.
out = out.replace(/<link rel="icon"[^>]*href="\/favicon\.svg"[^>]*>/g, () => {
  const svg = readFileSync('dist/favicon.svg');
  return `<link rel="icon" href="data:image/svg+xml;base64,${svg.toString('base64')}" />`;
});

// Drop modulepreload hints — the modules are inline now.
out = out.replace(/<link rel="modulepreload"[^>]*>/g, '');

writeFileSync('dist/index.html', out);

for (const name of readdirSync('dist/assets')) {
  if (!out.includes(name)) unlinkSync(join('dist/assets', name));
}
console.log(`Inlined. dist/index.html ${(statSync('dist/index.html').size / 1024).toFixed(0)} kB`);
