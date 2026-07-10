import remapping from '@ampproject/remapping';
import {
    type EncodedSourceMap,
    originalPositionFor,
    TraceMap,
} from '@jridgewell/trace-mapping';
import { transformWithEsbuild } from 'vite';
import { describe, expect, it } from 'vitest';
import { elemix } from '../src';
import { BIN, COUNTER_ID, COUNTER_SOURCE, runTransform } from './harness';

// The real chain: elemix lowers `tpl` (pass 1, our map), esbuild emits JS (pass 2,
// its map — the transpiler Vite/Rollup actually run on `.ts`), and Rollup composes
// the two with @ampproject/remapping. We reproduce that exactly and assert a
// generated position resolves to the ORIGINAL tpl source — the thing the in-repo
// unit tests (map-is-internally-honest) can't see.

// Shared virtual name for the compiled intermediate so remapping can chain
// js → compiled.ts → original.ts.
const COMPILED = 'compiled.ts';
// A verbatim line present identically in source + output → unambiguous origin.
const NEEDLE = 'this.state.count++';

// pass 1 (elemix) → pass 2 (esbuild) → compose. `chainEc=false` drops our map to
// prove it's the bridge back to the tpl source.
async function compose(chainEc: boolean): Promise<{
    js: string;
    map: EncodedSourceMap;
}> {
    const ec = await runTransform(
        elemix({ bin: BIN }),
        COUNTER_SOURCE,
        COUNTER_ID,
    );
    if (!ec) throw new Error('plugin returned null');

    const out = await transformWithEsbuild(ec.code, COMPILED, {
        loader: 'ts',
        sourcemap: true,
        target: 'es2022',
        format: 'esm',
    });
    const outMap = out.map as unknown as EncodedSourceMap;

    const composed = remapping(outMap, (file) =>
        chainEc && file === COMPILED
            ? (ec.map as unknown as EncodedSourceMap)
            : null,
    );
    return { js: out.code, map: composed as unknown as EncodedSourceMap };
}

// Where the needle lands in the generated JS (1-based line, 0-based column).
function locate(js: string): { line: number; column: number } {
    const lines = js.split('\n');
    const line = lines.findIndex((l) => l.includes(NEEDLE));
    return { line: line + 1, column: lines[line].indexOf(NEEDLE) };
}

describe('sourcemap composition (elemix ∘ esbuild, the Rollup chain)', () => {
    it('resolves a generated line back to the original tpl source', async () => {
        const { js, map } = await compose(true);
        const pos = originalPositionFor(new TraceMap(map), locate(js));

        expect(pos.source).toMatch(/CounterApp\.ts$/);
        const origLine = COUNTER_SOURCE.split('\n')[(pos.line ?? 0) - 1];
        expect(origLine).toContain(NEEDLE);
    });

    it('without our map the chain stops at the compiled intermediate', async () => {
        // Drops the pass-1 map (the old `map: null` behaviour) — the position
        // can only resolve to compiled.ts, never reaching the tpl source.
        const { js, map } = await compose(false);
        const pos = originalPositionFor(new TraceMap(map), locate(js));
        expect(pos.source).toBe(COMPILED);
    });
});
