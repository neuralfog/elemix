import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MatchApp';

export default { title: 'Compiled/MatchApp' };

export const Default = {
    render: () => '<match-app></match-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const buttons = query('.bar button', canvasElement);
        const idleButton = buttons[0] as HTMLButtonElement;
        const loadingButton = buttons[1] as HTMLButtonElement;
        const readyButton = buttons[2] as HTMLButtonElement;
        const failedButton = buttons[3] as HTMLButtonElement;

        const onlyCard = (cls: string, text: string): void => {
            const card = find(`.card.${cls}`, canvasElement);
            expect(card).toBeTruthy();
            expect(card?.textContent).toContain(text);
            for (const other of ['idle', 'loading', 'ready', 'failed']) {
                if (other !== cls) {
                    expect(find(`.card.${other}`, canvasElement)).toBeNull();
                }
            }
        };

        onlyCard('idle', 'Pick a state above');

        click(loadingButton);
        onlyCard('loading', 'Working 42%');
        expect(find('.card.loading .spinner', canvasElement)).toBeTruthy();

        click(readyButton);
        onlyCard('ready', 'Deployed to /build/app.js');

        click(failedButton);
        onlyCard('failed', 'boom');

        click(idleButton);
        onlyCard('idle', 'Pick a state above');

        const modeButton = find('.link', canvasElement) as HTMLButtonElement;
        expect(find('.mode', canvasElement)?.textContent).toBe('compact');
        click(modeButton);
        expect(find('.mode', canvasElement)?.textContent).toBe('full view');
        click(modeButton);
        expect(find('.mode', canvasElement)?.textContent).toBe('compact');
    },
};
