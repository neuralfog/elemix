import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/CustomEventApp';

export default { title: 'Compiled/CustomEventApp' };

export const Default = {
    render: () => '<custom-event-app></custom-event-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        expect(find('.caught', canvasElement)?.textContent).toBe('0');
        click(find<HTMLButtonElement>('.fire', canvasElement) as HTMLButtonElement);
        expect(find('.caught', canvasElement)?.textContent).toBe('1');
    },
};
