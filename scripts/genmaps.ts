/**
 * genmaps: compiles ASCII map sources (content/maps/*.map.txt) into
 * generated TS modules under src/data/maps/, validating terrain, entity
 * references, exit bidirectionality, and connectivity along the way.
 * Dialogue ids are collected from content/dialogue/*.json.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { emitIndexTs, emitMapTs, parseMapSource, validateAll } from './maplib.ts';
import type { CompiledMap } from '../src/core/mapdefs.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mapsDir = join(root, 'content', 'maps');
const dialogueDir = join(root, 'content', 'dialogue');
const outDir = join(root, 'src', 'data', 'maps');

function collectDialogueIds(dir: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(dir)) return ids;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      for (const key of Object.keys(parsed)) ids.add(key);
    }
  }
  return ids;
}

function main(): void {
  const sources = existsSync(mapsDir)
    ? readdirSync(mapsDir)
        .filter((f) => f.endsWith('.map.txt'))
        .sort()
    : [];

  if (sources.length === 0) {
    console.log('genmaps: no map sources in content/maps/ yet.');
    process.exit(0);
  }

  const allErrors: string[] = [];
  const maps: CompiledMap[] = [];
  const sourceNames = new Map<string, string>();

  for (const f of sources) {
    const text = readFileSync(join(mapsDir, f), 'utf8');
    const { map, errors } = parseMapSource(text, f);
    allErrors.push(...errors);
    if (map) {
      maps.push(map);
      sourceNames.set(map.id, `content/maps/${f}`);
    }
  }

  const dialogueIds = collectDialogueIds(dialogueDir);
  allErrors.push(...validateAll(maps, dialogueIds));

  if (allErrors.length > 0) {
    for (const e of allErrors) console.error(`genmaps: ${e}`);
    console.error(`genmaps: ${String(allErrors.length)} error(s), nothing written.`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  for (const map of maps) {
    const src = sourceNames.get(map.id) ?? 'unknown source';
    writeFileSync(join(outDir, `${map.id}.ts`), emitMapTs(map, src));
  }
  writeFileSync(join(outDir, 'index.ts'), emitIndexTs(maps));
  console.log(
    `genmaps: compiled ${String(maps.length)} map(s) -> src/data/maps/ (${maps
      .map((m) => m.id)
      .join(', ')})`,
  );
}

main();
