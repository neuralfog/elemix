import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import '../.emited/LifecycleApp';

export default { title: 'Compiled/LifecycleApp' };

export const Default = {
    render: () => '<lifecycle-app></lifecycle-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('lifecycle-app', canvasElement);
        if (!app) throw new Error('lifecycle-app did not render a shadow root');

        const buttons = query<HTMLButtonElement>('button', app);
        const toggle = buttons[0];
        const updateBtn = buttons[1];
        const clearBtn = buttons[2];
        if (!toggle || !updateBtn || !clearBtn) {
            throw new Error('lifecycle-app did not render its three buttons');
        }

        const logView = find('log-view', app);
        if (!logView) throw new Error('lifecycle-app missing log-view shadow root');

        const events = (): string[] =>
            query('.entry', logView).map((e) =>
                (e.textContent ?? '')
                    .replace(/\s+/g, '')
                    .replace(/^\d+/, '')
                    .replace(/\(\)$/, ''),
            );
        const count = (name: string): number =>
            events().filter((e) => e === name).length;
        const fx = (): string =>
            find('lifecycle-child', app)?.getAttribute('data-fx') ?? '';
        const flush = (): Promise<void> =>
            new Promise((r) => setTimeout(r, 0));

        click(clearBtn);
        await flush();

        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(find('lifecycle-child', app)).toBeNull();
        expect(updateBtn.disabled).toBe(true);
        expect(events()).toEqual([]);

        click(toggle);
        await flush();
        expect(toggle.textContent?.trim()).toBe('Unmount');
        expect(find('lifecycle-child', app)).not.toBeNull();
        expect(events()).toEqual(['before-1', 'before-2', 'mount-1', 'mount-2']);
        for (const e of ['before-1', 'before-2', 'mount-1', 'mount-2']) {
            expect(count(e)).toBe(1);
        }
        expect(fx()).toBe('A0B0');
        expect(updateBtn.disabled).toBe(false);
        expect(
            find('.child', find('lifecycle-child', app) ?? app)?.textContent,
        ).toBe('Child · tick 0');

        const logLen = events().length;
        click(updateBtn);
        await flush();
        expect(fx()).toBe('A0B0A1B1');
        expect(events().length).toBe(logLen);
        expect(
            find('.child', find('lifecycle-child', app) ?? app)?.textContent,
        ).toBe('Child · tick 1');

        click(updateBtn);
        await flush();
        expect(fx()).toBe('A0B0A1B1A2B2');
        expect(
            find('.child', find('lifecycle-child', app) ?? app)?.textContent,
        ).toBe('Child · tick 2');

        const mark = events().length;
        click(toggle);
        await flush();
        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(find('lifecycle-child', app)).toBeNull();
        expect(updateBtn.disabled).toBe(true);
        expect(events().slice(mark)).toEqual(['dispose-1', 'dispose-2']);
        expect(count('dispose-1')).toBe(1);
        expect(count('dispose-2')).toBe(1);

        click(clearBtn);
        await flush();
        expect(events()).toEqual([]);
        click(toggle);
        await flush();
        expect(find('.entry .n', logView)?.textContent).toBe('1');
        expect(events()).toEqual(['before-1', 'before-2', 'mount-1', 'mount-2']);
        expect(
            find('.child', find('lifecycle-child', app) ?? app)?.textContent,
        ).toBe('Child · tick 2');
        expect(fx()).toBe('A2B2');

        click(toggle);
        click(clearBtn);
        await flush();
    },
};
