import { expect, userEvent } from 'storybook/test';
import './.emited/MatchApp';

export default { title: 'Compiled/MatchApp' };

export const Default = {
    render: () => '<match-app></match-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('match-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('match-app did not render a shadow root');

        // .bar buttons in order: [Idle, Loading, Ready, Failed]
        const buttons = root.querySelectorAll('.bar button');
        const idleButton = buttons[0] as HTMLButtonElement;
        const loadingButton = buttons[1] as HTMLButtonElement;
        const readyButton = buttons[2] as HTMLButtonElement;
        const failedButton = buttons[3] as HTMLButtonElement;

        // only ONE match arm renders at a time.
        const onlyCard = (cls: string, text: string): void => {
            const card = root.querySelector(`.card.${cls}`);
            expect(card).toBeTruthy();
            expect(card?.textContent).toContain(text);
            for (const other of ['idle', 'loading', 'ready', 'failed']) {
                if (other !== cls) {
                    expect(root.querySelector(`.card.${other}`)).toBeNull();
                }
            }
        };

        // initial: load.kind === 'idle' → idle arm.
        onlyCard('idle', 'Pick a state above');

        // loading arm: the narrowed member exposes `pct`.
        await userEvent.click(loadingButton);
        onlyCard('loading', 'Working 42%');
        expect(root.querySelector('.card.loading .spinner')).toBeTruthy();

        // ready arm: narrowed member exposes `url`.
        await userEvent.click(readyButton);
        onlyCard('ready', 'Deployed to /build/app.js');

        // failed arm: narrowed member exposes `error`.
        await userEvent.click(failedButton);
        onlyCard('failed', 'boom');

        // back to idle re-mounts the idle arm.
        await userEvent.click(idleButton);
        onlyCard('idle', 'Pick a state above');

        // form-1 match on a literal union reacts to its own value.
        const modeButton = root.querySelector('.link') as HTMLButtonElement;
        expect(root.querySelector('.mode')?.textContent).toBe('compact');
        await userEvent.click(modeButton);
        expect(root.querySelector('.mode')?.textContent).toBe('full view');
        await userEvent.click(modeButton);
        expect(root.querySelector('.mode')?.textContent).toBe('compact');
    },
};
