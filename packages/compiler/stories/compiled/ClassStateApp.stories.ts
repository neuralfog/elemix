import { expect } from '@neuralfog/elemix-testing-library';
import { click as clickEl } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ClassStateApp';

export default { title: 'Compiled/ClassStateApp' };

export const Default = {
    render: () => '<class-state-app></class-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const read = (sel: string): string =>
            find(sel, canvasElement)?.textContent ?? '';
        const col = (cls: string): string[] =>
            [...query(`ul.items li.item .${cls}`, canvasElement)].map(
                (el) => el.textContent ?? '',
            );
        const click = async (sel: string): Promise<void> => {
            const btn = find(sel, canvasElement);
            if (!btn) throw new Error(`missing button ${sel}`);
            clickEl(btn);
        };

        // ----- initial: Cart.count / subtotal / total are prototype getters,
        // subtotal reads each Item.lineTotal getter (price * qty) -----
        expect(read('.count')).toBe('2');
        expect(read('.subtotal')).toBe('7'); // apple 2*2=4 + banana 1*3=3
        expect(read('.coupon')).toBe('0');
        expect(read('.total')).toBe('7');
        expect(col('name')).toEqual(['apple', 'banana']);
        expect(col('qty')).toEqual(['2', '3']);
        expect(col('line')).toEqual(['4', '3']);

        // ----- method on a NESTED class instance: Item.bump() mutates qty,
        // its lineTotal getter recomputes, and Cart.subtotal/total follow -----
        await click('.bump');
        expect(col('qty')).toEqual(['3', '3']);
        expect(col('line')).toEqual(['6', '3']); // apple 2*3=6
        expect(read('.subtotal')).toBe('9');
        expect(read('.total')).toBe('9');
        expect(read('.count')).toBe('2');

        // ----- method on the class pushing a NEW class instance into the array -----
        await click('.add');
        expect(read('.count')).toBe('3');
        expect(read('.subtotal')).toBe('14'); // 6 + 3 + cherry 5*1=5
        expect(read('.total')).toBe('14');
        expect(col('name')).toEqual(['apple', 'banana', 'cherry']);
        expect(col('qty')).toEqual(['3', '3', '1']);
        expect(col('line')).toEqual(['6', '3', '5']);

        // ----- direct PUBLIC FIELD write: cart.coupon = 3, total getter follows -----
        await click('.coupon-btn');
        expect(read('.coupon')).toBe('3');
        expect(read('.subtotal')).toBe('14');
        expect(read('.total')).toBe('11'); // 14 - 3

        // ----- method splicing the array: Cart.remove('p2') -----
        await click('.remove');
        expect(read('.count')).toBe('2');
        expect(read('.subtotal')).toBe('11'); // apple 6 + cherry 5
        expect(read('.total')).toBe('8'); // 11 - 3
        expect(col('name')).toEqual(['apple', 'cherry']);
        expect(col('qty')).toEqual(['3', '1']);
        expect(col('line')).toEqual(['6', '5']);

        // ----- method mutating array + field together: Cart.clear() -----
        await click('.clear');
        expect(read('.count')).toBe('0');
        expect(read('.subtotal')).toBe('0');
        expect(read('.coupon')).toBe('0');
        expect(read('.total')).toBe('0');
        expect(col('name')).toEqual([]);
    },
};
