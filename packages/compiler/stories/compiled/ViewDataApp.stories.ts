import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import { $__setViewData } from '@neuralfog/elemix/runtime';
import './.emited/ViewDataApp';

export default { title: 'Compiled/ViewDataApp' };

export const Default = {
    render: () => {
        $__setViewData({
            title: 'Hello viewData',
            user: { name: 'Ada' },
            count: 3,
        });
        return '<view-data-app></view-data-app>';
    },
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('view-data-app', canvasElement);
        if (!app) throw new Error('view-data-app did not mount');

        const title = find('.title', app);
        const mid = find('view-data-mid', app);
        const count = mid && find('.count', mid);
        const leaf = mid && find('view-data-leaf', mid);
        const leafName = leaf && find('.leaf-name', leaf);
        if (!title || !count || !leafName) {
            throw new Error('view-data-app missing readouts at some depth');
        }

        expect(title.textContent).toBe('Hello viewData');
        expect(count.textContent).toBe('3');
        expect(leafName.textContent).toBe('Ada');
    },
};
