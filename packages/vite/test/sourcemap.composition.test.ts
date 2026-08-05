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

const COMPILED = 'compiled.ts';
const NEEDLE = 'this.state.count++';

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
        const { js, map } = await compose(false);
        const pos = originalPositionFor(new TraceMap(map), locate(js));
        expect(pos.source).toBe(COMPILED);
    });
});
