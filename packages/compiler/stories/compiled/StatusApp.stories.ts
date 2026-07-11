import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StatusApp';

export default { title: 'Compiled/StatusApp' };

export const Default = {
    render: () => '<status-app></status-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // initial: status="idle" → idle card (the [true, ...] choose fallback)
        const idle0 = find('.card.idle', canvasElement);
        expect(idle0).toBeTruthy();
        expect(idle0?.textContent).toContain('Pick a status above');
        // only one choose branch is ever rendered
        expect(find('.card.loading', canvasElement)).toBeNull();
        expect(find('.card.ready', canvasElement)).toBeNull();
        expect(find('.card.failed', canvasElement)).toBeNull();

        // .bar buttons in order: [Idle, Loading, Ready, Failed]
        const buttons = query('button', canvasElement);
        const idleButton = buttons[0];
        const loadingButton = buttons[1];
        const readyButton = buttons[2];
        const failedButton = buttons[3];
        const logButton = find('.link', canvasElement) as HTMLButtonElement;
        expect(idleButton.textContent).toBe('Idle');
        expect(loadingButton.textContent).toBe('Loading');
        expect(readyButton.textContent).toBe('Ready');
        expect(failedButton.textContent).toBe('Failed');
        // initial log link label
        expect(logButton.textContent?.trim()).toBe('Show log');

        // loading → loading card (choose first truthy branch), idle unmounts
        click(loadingButton);
        const loading = find('.card.loading', canvasElement);
        expect(loading).toBeTruthy();
        expect(loading?.textContent).toContain('Working');
        expect(find('.spinner', loading ?? canvasElement)).toBeTruthy();
        expect(find('.card.idle', canvasElement)).toBeNull();

        // ready → ready card, loading unmounts
        click(readyButton);
        const ready = find('.card.ready', canvasElement);
        expect(ready).toBeTruthy();
        expect(ready?.textContent).toContain('Deployed');
        expect(find('.card.loading', canvasElement)).toBeNull();

        // failed → failed card, ready unmounts
        click(failedButton);
        const failed = find('.card.failed', canvasElement);
        expect(failed).toBeTruthy();
        expect(failed?.textContent).toContain('Build failed');
        expect(find('.card.ready', canvasElement)).toBeNull();

        // back to idle → fallback branch re-mounts, failed unmounts
        click(idleButton);
        expect(find('.card.idle', canvasElement)).toBeTruthy();
        expect(find('.card.failed', canvasElement)).toBeNull();

        // toggle log via .link button → when-branch mounts a <pre class="log">
        expect(find('pre.log', canvasElement)).toBeNull();
        click(logButton);
        const log = find('pre.log', canvasElement);
        expect(log).toBeTruthy();
        // status is currently idle
        expect(log?.textContent).toContain('status = idle');
        expect(logButton.textContent?.trim()).toBe('Hide log');

        // changing status while log open updates the readout reactively
        click(readyButton);
        expect(find('pre.log', canvasElement)?.textContent).toContain(
            'status = ready',
        );

        // hide log → when-branch unmounts, label flips back
        click(logButton);
        expect(find('pre.log', canvasElement)).toBeNull();
        expect(logButton.textContent?.trim()).toBe('Show log');
    },
};
