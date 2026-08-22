import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/IconButtonApp';

export default { title: 'Compiled/IconButtonApp' };

export const Default = {
    render: () => '<icon-button-app></icon-button-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const iconButton = find('icon-button', canvasElement);
        if (!iconButton) throw new Error('icon-button-app did not render');

        const button = find('button', iconButton) as HTMLButtonElement;
        const pip = find('.pip', canvasElement);
        expect(pip?.textContent).toBe('★');
        expect(button.textContent).toBe('');

        const setBtn = find('button.set', canvasElement) as HTMLButtonElement;
        const clearBtn = find(
            'button.clear',
            canvasElement,
        ) as HTMLButtonElement;

        click(setBtn);
        expect(button.textContent).toBe('Saved');
        expect(pip?.textContent).toBe('★');

        click(clearBtn);
        expect(button.textContent).toBe('');
        expect(pip?.textContent).toBe('★');
    },
};
