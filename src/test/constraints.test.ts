import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with the project root as the working directory, so paths are
// resolved from there rather than from import.meta.url (which is not a plain
// file URL under the test transform).
const projectRoot = process.cwd();
const srcDir = join(projectRoot, 'src');

/** Recursively collect application source files, excluding test files. */
function collectAppSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectAppSourceFiles(full));
      continue;
    }
    const isTs = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx');
    const isTest = entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx');
    const isSetup = full === join(srcDir, 'test', 'setup.ts');
    if (isTs && !isTest && !isSetup) {
      out.push(full);
    }
  }
  return out;
}

describe('runtime dependency constraints (AC-NFR-01.5)', () => {
  it('declares exactly react, react-dom and lucide-react as runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const names = Object.keys(pkg.dependencies ?? {}).sort();
    expect(names).toEqual(['lucide-react', 'react', 'react-dom']);
  });
});

describe('application source hygiene (AC-NFR-01.1, AC-NFR-01.6)', () => {
  const files = collectAppSourceFiles(srcDir);

  it('finds application source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('does not use the any type in application code (AC-NFR-01.1)', () => {
    const anyPattern = /(:\s*any\b)|(\bas\s+any\b)|(<any>)/;
    const offenders = files.filter((file) => anyPattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not make network requests for app data (AC-NFR-01.6)', () => {
    const networkPattern = /\bfetch\s*\(|\bXMLHttpRequest\b/;
    const offenders = files.filter((file) => networkPattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
