import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StatusApp';

export default { title: 'Compiled/StatusApp' };

export const Default = {
    render: () => '<status-app></status-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const idle0 = find('.card.idle', canvasElement);
        expect(idle0).toBeTruthy();
        expect(idle0?.textContent).toContain('Pick a status above');
        expect(find('.card.loading', canvasElement)).toBeNull();
        expect(find('.card.ready', canvasElement)).toBeNull();
        expect(find('.card.failed', canvasElement)).toBeNull();

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
        expect(logButton.textContent?.trim()).toBe('Show log');

        click(loadingButton);
        const loading = find('.card.loading', canvasElement);
        expect(loading).toBeTruthy();
        expect(loading?.textContent).toContain('Working');
        expect(find('.spinner', loading ?? canvasElement)).toBeTruthy();
        expect(find('.card.idle', canvasElement)).toBeNull();

        click(readyButton);
        const ready = find('.card.ready', canvasElement);
        expect(ready).toBeTruthy();
        expect(ready?.textContent).toContain('Deployed');
        expect(find('.card.loading', canvasElement)).toBeNull();

        click(failedButton);
        const failed = find('.card.failed', canvasElement);
        expect(failed).toBeTruthy();
        expect(failed?.textContent).toContain('Build failed');
        expect(find('.card.ready', canvasElement)).toBeNull();

        click(idleButton);
        expect(find('.card.idle', canvasElement)).toBeTruthy();
        expect(find('.card.failed', canvasElement)).toBeNull();

        expect(find('pre.log', canvasElement)).toBeNull();
        click(logButton);
        const log = find('pre.log', canvasElement);
        expect(log).toBeTruthy();
        expect(log?.textContent).toContain('status = idle');
        expect(logButton.textContent?.trim()).toBe('Hide log');

        click(readyButton);
        expect(find('pre.log', canvasElement)?.textContent).toContain(
            'status = ready',
        );

        click(logButton);
        expect(find('pre.log', canvasElement)).toBeNull();
        expect(logButton.textContent?.trim()).toBe('Show log');
    },
};
