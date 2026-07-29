import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './view-data-store-seed';
import './.emited/ViewDataStoreApp';

export default { title: 'Compiled/ViewDataStoreApp' };

export const Default = {
    render: () => '<view-data-store-app></view-data-store-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('view-data-store-app', canvasElement);
        if (!app) throw new Error('view-data-store-app did not mount');

        const count = find('.count', app);
        const inc = find('.inc', app);
        if (!count || !inc) throw new Error('view-data-store-app missing readouts');

        expect(count.textContent).toBe('5');
        click(inc as HTMLButtonElement);
        expect(count.textContent).toBe('6');
        click(inc as HTMLButtonElement);
        expect(count.textContent).toBe('7');
    },
};
