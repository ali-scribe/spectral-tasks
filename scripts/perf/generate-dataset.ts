// CLI: writes the deterministic performance data sets to scripts/perf/out/.
// Run with `npm run perf:data`. Dev tooling only; not part of the app bundle.
// See docs/performance.md for how the files are used.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consoleSnippet, datasetFiles } from './dataset.ts';

const outDir = join(process.cwd(), 'scripts', 'perf', 'out');
mkdirSync(outDir, { recursive: true });

for (const file of datasetFiles()) {
  // The .json file is exactly the string the app stores (no trailing newline).
  writeFileSync(join(outDir, file.json), file.content, 'utf8');
  writeFileSync(join(outDir, file.snippet), consoleSnippet(file.content), 'utf8');
  console.log(`${file.description}`);
  console.log(`  scripts/perf/out/${file.json}`);
  console.log(`  scripts/perf/out/${file.snippet}`);
}
