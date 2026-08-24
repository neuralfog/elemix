import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/PropsApp';

export default { title: 'Compiled/PropsApp' };

export const Default = {
    render: () => '<props-app></props-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const child = find('props-child', canvasElement);
        if (!child) throw new Error('props-app did not render props-child');

        const label = find('.label', child);
        const count = find('.count', child);
        const flag = find('.flag', child);
        const tags = find('.tags', child);
        const pcount = find('.parent .pcount', canvasElement);
        const ptags = find('.parent .ptags', canvasElement);
        if (!label || !count || !flag || !tags || !pcount || !ptags) {
            throw new Error('props-app missing child/parent readouts');
        }

        expect(label.textContent).toBe('hello');
        expect(count.textContent).toBe('0');
        expect(flag.textContent).toBe('yes');
        expect(tags.textContent).toBe('a');
        expect(pcount.textContent).toBe('0');
        expect(ptags.textContent).toBe('a');

        click(find('.bump', child) as HTMLButtonElement);
        expect(pcount.textContent).toBe('1');
        expect(count.textContent).toBe('1');
        click(find('.bump', child) as HTMLButtonElement);
        expect(pcount.textContent).toBe('2');
        expect(count.textContent).toBe('2');

        click(find('.add', child) as HTMLButtonElement);
        expect(ptags.textContent).toBe('a,x');
        expect(tags.textContent).toBe('a,x');
        click(find('.add', child) as HTMLButtonElement);
        expect(ptags.textContent).toBe('a,x,x');
        expect(tags.textContent).toBe('a,x,x');

        click(find('.push', child) as HTMLButtonElement);
        expect(tags.textContent).toBe('a,x,x,y');
        expect(ptags.textContent).toBe('a,x,x,y');
    },
};
