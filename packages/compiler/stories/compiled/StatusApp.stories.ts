import { expect, userEvent } from 'storybook/test';
import './.emited/StatusApp';

export default { title: 'Compiled/StatusApp' };

export const Default = {
    render: () => '<status-app></status-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('status-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('status-app did not render a shadow root');

        // initial: status="idle" → idle card (the [true, ...] choose fallback)
        const idle0 = root.querySelector('.card.idle');
        expect(idle0).toBeTruthy();
        expect(idle0?.textContent).toContain('Pick a status above');
        // only one choose branch is ever rendered
        expect(root.querySelector('.card.loading')).toBeNull();
        expect(root.querySelector('.card.ready')).toBeNull();
        expect(root.querySelector('.card.failed')).toBeNull();

        // .bar buttons in order: [Idle, Loading, Ready, Failed]
        const buttons = root.querySelectorAll('button');
        const idleButton = buttons[0];
        const loadingButton = buttons[1];
        const readyButton = buttons[2];
        const failedButton = buttons[3];
        const logButton = root.querySelector('.link') as HTMLButtonElement;
        expect(idleButton.textContent).toBe('Idle');
        expect(loadingButton.textContent).toBe('Loading');
        expect(readyButton.textContent).toBe('Ready');
        expect(failedButton.textContent).toBe('Failed');
        // initial log link label
        expect(logButton.textContent?.trim()).toBe('Show log');

        // loading → loading card (choose first truthy branch), idle unmounts
        await userEvent.click(loadingButton);
        const loading = root.querySelector('.card.loading');
        expect(loading).toBeTruthy();
        expect(loading?.textContent).toContain('Working');
        expect(loading?.querySelector('.spinner')).toBeTruthy();
        expect(root.querySelector('.card.idle')).toBeNull();

        // ready → ready card, loading unmounts
        await userEvent.click(readyButton);
        const ready = root.querySelector('.card.ready');
        expect(ready).toBeTruthy();
        expect(ready?.textContent).toContain('Deployed');
        expect(root.querySelector('.card.loading')).toBeNull();

        // failed → failed card, ready unmounts
        await userEvent.click(failedButton);
        const failed = root.querySelector('.card.failed');
        expect(failed).toBeTruthy();
        expect(failed?.textContent).toContain('Build failed');
        expect(root.querySelector('.card.ready')).toBeNull();

        // back to idle → fallback branch re-mounts, failed unmounts
        await userEvent.click(idleButton);
        expect(root.querySelector('.card.idle')).toBeTruthy();
        expect(root.querySelector('.card.failed')).toBeNull();

        // toggle log via .link button → when-branch mounts a <pre class="log">
        expect(root.querySelector('pre.log')).toBeNull();
        await userEvent.click(logButton);
        const log = root.querySelector('pre.log');
        expect(log).toBeTruthy();
        // status is currently idle
        expect(log?.textContent).toContain('status = idle');
        expect(logButton.textContent?.trim()).toBe('Hide log');

        // changing status while log open updates the readout reactively
        await userEvent.click(readyButton);
        expect(root.querySelector('pre.log')?.textContent).toContain(
            'status = ready',
        );

        // hide log → when-branch unmounts, label flips back
        await userEvent.click(logButton);
        expect(root.querySelector('pre.log')).toBeNull();
        expect(logButton.textContent?.trim()).toBe('Show log');
    },
};
