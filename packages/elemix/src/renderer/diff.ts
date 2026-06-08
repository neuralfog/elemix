import type { HtmlTemplate } from './types';

export type DiffDeleteOp = { key: string };
export type DiffInsertOp = {
    key: string;
    value: HtmlTemplate;
    beforeKey?: string;
};
export type DiffMoveOp = { key: string; beforeKey?: string };

export type DiffResult = {
    deletes: DiffDeleteOp[];
    inserts: DiffInsertOp[];
    moves: DiffMoveOp[];
};

const EMPTY: DiffResult = { deletes: [], inserts: [], moves: [] };

export const diff = (
    oldArr: HtmlTemplate[],
    newArr: HtmlTemplate[],
): DiffResult => {
    const oldLen = oldArr.length;
    const newLen = newArr.length;

    if (oldLen === newLen) {
        let same = true;
        for (let i = 0; i < oldLen; i++) {
            if (oldArr[i].key !== newArr[i].key) {
                same = false;
                break;
            }
        }
        if (same) return EMPTY;
    }

    // eslint-disable-next-line no-null/no-null
    const oldIndex: Record<string, number> = Object.create(null);
    for (let i = 0; i < oldLen; i++) oldIndex[oldArr[i].key] = i;

    const newIndices = new Int32Array(newLen);
    const seq: number[] = [];
    const posMap: number[] = [];
    // eslint-disable-next-line no-null/no-null
    const inNew: Record<string, true> = Object.create(null);

    for (let i = 0; i < newLen; i++) {
        const k = newArr[i].key;
        inNew[k] = true;
        const oi = oldIndex[k];
        if (oi === undefined) {
            newIndices[i] = -1;
        } else {
            newIndices[i] = oi;
            seq.push(oi);
            posMap.push(i);
        }
    }

    const lisIdx = computeLIS(seq);
    const keep = new Uint8Array(newLen);
    for (let i = 0; i < lisIdx.length; i++) keep[posMap[lisIdx[i]]] = 1;

    const deletes: DiffDeleteOp[] = [];
    const inserts: DiffInsertOp[] = [];
    const moves: DiffMoveOp[] = [];

    for (let i = 0; i < oldLen; i++) {
        if (inNew[oldArr[i].key] !== true) deletes.push({ key: oldArr[i].key });
    }

    for (let i = 0; i < newLen; i++) {
        const beforeKey = i + 1 < newLen ? newArr[i + 1].key : undefined;
        if (newIndices[i] === -1) {
            inserts.push({ key: newArr[i].key, value: newArr[i], beforeKey });
        } else if (!keep[i]) {
            moves.push({ key: newArr[i].key, beforeKey });
        }
    }

    return { deletes, inserts, moves };
};

const computeLIS = (arr: number[]): number[] => {
    const n = arr.length;
    if (n === 0) return [];

    const pred = new Int32Array(n);
    const tails = new Int32Array(n);
    let len = 0;

    for (let i = 0; i < n; i++) {
        let lo = 0;
        let hi = len;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (arr[tails[mid]] < arr[i]) lo = mid + 1;
            else hi = mid;
        }
        tails[lo] = i;
        if (lo === len) len++;
        pred[i] = lo > 0 ? tails[lo - 1] : -1;
    }

    const lis = new Array(len);
    let k = tails[len - 1];
    for (let i = len - 1; i >= 0; i--) {
        lis[i] = k;
        k = pred[k];
    }
    return lis;
};
