import { expect } from '@neuralfog/elemix-testing-library';
import { click as clickEl } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/CollectionApp';

export default { title: 'Compiled/CollectionApp' };

export const Default = {
    render: () => '<collection-app></collection-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const read = (sel: string): string =>
            find(sel, canvasElement)?.textContent ?? '';
        const list = (sel: string): string[] =>
            [...query(sel, canvasElement)].map((el) => el.textContent ?? '');
        const click = async (sel: string): Promise<void> => {
            const btn = find(sel, canvasElement);
            if (!btn) throw new Error(`missing button ${sel}`);
            clickEl(btn);
        };

        // ----- initial state: every read method off Set, Map, WeakSet, WeakMap -----
        // Set: size / has / keys / values / entries / Symbol.iterator / forEach
        expect(read('.set-size')).toBe('2');
        expect(read('.set-has')).toBe('false');
        expect(read('.set-keys')).toBe('new,featured');
        expect(read('.set-values')).toBe('new,featured');
        expect(read('.set-entries')).toBe('new=new,featured=featured');
        expect(read('.set-iter')).toBe('new,featured');
        expect(read('.set-foreach')).toBe('new,featured');
        // Map: size / get / has / keys / values / entries / Symbol.iterator / forEach
        expect(read('.map-size')).toBe('1');
        expect(read('.map-get')).toBe('10');
        expect(read('.map-has')).toBe('true');
        expect(read('.map-keys')).toBe('alice');
        expect(read('.map-values')).toBe('10');
        expect(read('.map-entries')).toBe('alice=10');
        expect(read('.map-iter')).toBe('alice=10');
        expect(read('.map-total')).toBe('10');
        // Weak collections: has / get
        expect(read('.ws-has')).toBe('false');
        expect(read('.wm-has')).toBe('false');
        expect(read('.wm-get')).toBe('');
        // lists driven by Set Symbol.iterator and Map keys()
        expect(list('ul.tags li')).toEqual(['new', 'featured']);
        expect(list('ul.scores li')).toEqual(['alice: 10']);

        // ----- Set.add (new member) -----
        await click('.add-tag');
        expect(read('.set-size')).toBe('3');
        expect(read('.set-has')).toBe('true');
        expect(read('.set-keys')).toBe('new,featured,vip');
        expect(read('.set-values')).toBe('new,featured,vip');
        expect(read('.set-entries')).toBe('new=new,featured=featured,vip=vip');
        expect(read('.set-iter')).toBe('new,featured,vip');
        expect(read('.set-foreach')).toBe('new,featured,vip');
        expect(list('ul.tags li')).toEqual(['new', 'featured', 'vip']);

        // ----- Set.add (duplicate → no-op) -----
        await click('.add-tag');
        expect(read('.set-size')).toBe('3');
        expect(read('.set-keys')).toBe('new,featured,vip');

        // ----- Set.delete -----
        await click('.remove-tag');
        expect(read('.set-size')).toBe('2');
        expect(read('.set-has')).toBe('false');
        expect(read('.set-keys')).toBe('new,featured');
        expect(list('ul.tags li')).toEqual(['new', 'featured']);

        // ----- Set.clear -----
        await click('.clear-tags');
        expect(read('.set-size')).toBe('0');
        expect(read('.set-has')).toBe('false');
        expect(read('.set-keys')).toBe('');
        expect(read('.set-values')).toBe('');
        expect(read('.set-entries')).toBe('');
        expect(read('.set-iter')).toBe('');
        expect(read('.set-foreach')).toBe('');
        expect(list('ul.tags li')).toEqual([]);

        // ----- Map.set (update existing key) -----
        await click('.bump-alice');
        expect(read('.map-size')).toBe('1');
        expect(read('.map-get')).toBe('11');
        expect(read('.map-keys')).toBe('alice');
        expect(read('.map-values')).toBe('11');
        expect(read('.map-entries')).toBe('alice=11');
        expect(read('.map-iter')).toBe('alice=11');
        expect(read('.map-total')).toBe('11');
        expect(list('ul.scores li')).toEqual(['alice: 11']);

        // ----- Map.set (new key) -----
        await click('.set-bob');
        expect(read('.map-size')).toBe('2');
        expect(read('.map-keys')).toBe('alice,bob');
        expect(read('.map-values')).toBe('11,5');
        expect(read('.map-entries')).toBe('alice=11,bob=5');
        expect(read('.map-iter')).toBe('alice=11,bob=5');
        expect(read('.map-total')).toBe('16');
        expect(list('ul.scores li')).toEqual(['alice: 11', 'bob: 5']);

        // ----- Map.set (update again, only touched row + total move) -----
        await click('.bump-alice');
        expect(read('.map-get')).toBe('12');
        expect(read('.map-values')).toBe('12,5');
        expect(read('.map-total')).toBe('17');
        expect(list('ul.scores li')).toEqual(['alice: 12', 'bob: 5']);

        // ----- Map.delete -----
        await click('.del-alice');
        expect(read('.map-size')).toBe('1');
        expect(read('.map-get')).toBe('');
        expect(read('.map-has')).toBe('false');
        expect(read('.map-keys')).toBe('bob');
        expect(read('.map-values')).toBe('5');
        expect(read('.map-total')).toBe('5');
        expect(list('ul.scores li')).toEqual(['bob: 5']);

        // ----- Map.clear -----
        await click('.clear-scores');
        expect(read('.map-size')).toBe('0');
        expect(read('.map-get')).toBe('');
        expect(read('.map-keys')).toBe('');
        expect(read('.map-values')).toBe('');
        expect(read('.map-entries')).toBe('');
        expect(read('.map-total')).toBe('0');
        expect(list('ul.scores li')).toEqual([]);

        // ----- WeakSet.add / WeakSet.delete (tracked via has) -----
        await click('.add-seen');
        expect(read('.ws-has')).toBe('true');
        await click('.del-seen');
        expect(read('.ws-has')).toBe('false');

        // ----- WeakMap.set / WeakMap.delete (tracked via has + get) -----
        await click('.set-meta');
        expect(read('.wm-has')).toBe('true');
        expect(read('.wm-get')).toBe('hello');
        await click('.del-meta');
        expect(read('.wm-has')).toBe('false');
        expect(read('.wm-get')).toBe('');
    },
};
