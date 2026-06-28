import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (['.js', '.jsx'].includes(extname(path))) files.push(path);
  }
  return files;
}

const files = await walk(new URL('../src', import.meta.url).pathname);
const problems = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  if (/className\s*=[^>]*className\s*=/s.test(source)) {
    problems.push(`${file}: possibile proprietà className duplicata`);
  }
  if (/\bTODO\b|\bFIXME\b/.test(source)) {
    problems.push(`${file}: contiene TODO/FIXME`);
  }
  if (/console\.log\(/.test(source)) {
    problems.push(`${file}: contiene console.log`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log(`Controllati ${files.length} file sorgente.`);
