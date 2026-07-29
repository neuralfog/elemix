import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import { $__setViewData } from '@neuralfog/elemix/runtime';
import './.emited/ViewDataRichApp';

export default { title: 'Compiled/ViewDataRichApp' };

export const Default = {
    render: () => {
        $__setViewData({
            str: 'hello',
            num: 42,
            bool: true,
            nil: null,
            tags: ['a', 'b', 'c'],
            scores: [1, 2, 3, 4],
            obj: { a: 'x', b: 7 },
            nested: { deep: { value: 'buried' } },
            rows: [
                { id: 1, label: 'one' },
                { id: 2, label: 'two' },
            ],
        });
        return '<view-data-rich-app></view-data-rich-app>';
    },
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('view-data-rich-app', canvasElement);
        if (!app) throw new Error('view-data-rich-app did not mount');

        const text = (c: string): string | null =>
            find(c, app)?.textContent ?? null;

        expect(text('.str')).toBe('hello');
        expect(text('.num')).toBe('42');
        expect(text('.bool')).toBe('yes');
        expect(text('.nil')).toBe('none');
        expect(text('.tags')).toBe('a,b,c');
        expect(text('.scores-len')).toBe('4');
        expect(text('.scores-sum')).toBe('10');
        expect(text('.obj-a')).toBe('x');
        expect(text('.obj-b')).toBe('7');
        expect(text('.deep')).toBe('buried');

        const rows = app.shadowRoot?.querySelectorAll('.rows .row') ?? [];
        expect(rows.length).toBe(2);
        expect(rows[0]?.textContent).toBe('1:one');
        expect(rows[1]?.textContent).toBe('2:two');
    },
};
