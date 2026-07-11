import { pierce, pierceAll, type QueryRoot } from './pierce';

export const query = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T[] => pierceAll<T>(selector, root);

export const find = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T | null => pierce<T>(selector, root);

export const findFirst = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T | null => query<T>(selector, root)[0] ?? null;

export const findLast = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T | null => {
    const all = query<T>(selector, root);
    return all[all.length - 1] ?? null;
};

const testId = (id: string): string => `[data-testid="${id}"]`;

export const queryByTestId = <T extends Element = Element>(
    id: string,
    root: QueryRoot = document,
): T[] => query<T>(testId(id), root);

export const findByTestId = <T extends Element = Element>(
    id: string,
    root: QueryRoot = document,
): T | null => find<T>(testId(id), root);
