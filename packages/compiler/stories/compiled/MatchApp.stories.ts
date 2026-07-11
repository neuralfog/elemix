import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MatchApp';

export default { title: 'Compiled/MatchApp' };

export const Default = {
    render: () => '<match-app></match-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // .bar buttons in order: [Idle, Loading, Ready, Failed]
        const buttons = query('.bar button', canvasElement);
        const idleButton = buttons[0] as HTMLButtonElement;
        const loadingButton = buttons[1] as HTMLButtonElement;
        const readyButton = buttons[2] as HTMLButtonElement;
        const failedButton = buttons[3] as HTMLButtonElement;

        // only ONE match arm renders at a time.
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

        // initial: load.kind === 'idle' → idle arm.
        onlyCard('idle', 'Pick a state above');

        // loading arm: the narrowed member exposes `pct`.
        click(loadingButton);
        onlyCard('loading', 'Working 42%');
        expect(find('.card.loading .spinner', canvasElement)).toBeTruthy();

        // ready arm: narrowed member exposes `url`.
        click(readyButton);
        onlyCard('ready', 'Deployed to /build/app.js');

        // failed arm: narrowed member exposes `error`.
        click(failedButton);
        onlyCard('failed', 'boom');

        // back to idle re-mounts the idle arm.
        click(idleButton);
        onlyCard('idle', 'Pick a state above');

        // form-1 match on a literal union reacts to its own value.
        const modeButton = find('.link', canvasElement) as HTMLButtonElement;
        expect(find('.mode', canvasElement)?.textContent).toBe('compact');
        click(modeButton);
        expect(find('.mode', canvasElement)?.textContent).toBe('full view');
        click(modeButton);
        expect(find('.mode', canvasElement)?.textContent).toBe('compact');
    },
};
