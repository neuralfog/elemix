import { expect, userEvent } from 'storybook/test';
import '../.emited/LifecycleApp';

export default { title: 'Compiled/LifecycleApp' };

export const Default = {
    render: () => '<lifecycle-app></lifecycle-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('lifecycle-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('lifecycle-app did not render a shadow root');

        const buttons = root.querySelectorAll('button');
        const toggle = buttons[0];
        const updateBtn = buttons[1] as HTMLButtonElement;
        const clearBtn = buttons[2];
        if (!toggle || !updateBtn || !clearBtn) {
            throw new Error('lifecycle-app did not render its three buttons');
        }
        expect(updateBtn.textContent?.trim()).toBe('Update child');
        expect(clearBtn.textContent?.trim()).toBe('Clear log');

        // log lives in the log-view child's own shadow root
        const logView = root.querySelector('log-view');
        const logRoot = logView?.shadowRoot;
        if (!logRoot) throw new Error('lifecycle-app missing log-view shadow root');
        const events = (): string[] =>
            Array.from(logRoot.querySelectorAll('.entry')).map((e) =>
                e.classList.contains('beforeMount') ? 'beforeMount'
                    : e.classList.contains('onMount') ? 'onMount'
                    : e.classList.contains('onMutation') ? 'onMutation'
                    : e.classList.contains('onDispose') ? 'onDispose'
                    : '?',
            );
        const count = (name: string): number =>
            events().filter((e) => e === name).length;
        // lifecycle hooks flush on a microtask before they reach the log
        const flush = () => new Promise((r) => setTimeout(r, 0));

        // start from a clean log regardless of prior story state
        await userEvent.click(clearBtn);
        await flush();

        // initial: child unmounted, placeholder present, no child element
        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(root.querySelector('.stage .empty')?.textContent).toBe('child unmounted');
        expect(root.querySelector('lifecycle-child')).toBeNull();
        // Update child is disabled while unmounted
        expect(updateBtn.disabled).toBe(true);
        // empty-log placeholder shown
        expect(logRoot.querySelector('.empty')?.textContent).toBe(
            'No events yet — mount the child.',
        );
        expect(events()).toEqual([]);

        // mount the child -> beforeMount then onMount fire, child renders tick 0
        await userEvent.click(toggle);
        expect(toggle.textContent?.trim()).toBe('Unmount');
        const child = root.querySelector('lifecycle-child');
        expect(child).not.toBeNull();
        expect(child?.shadowRoot?.querySelector('.child')?.textContent).toBe(
            'Child · tick 0',
        );
        // Update child becomes enabled once mounted
        expect(updateBtn.disabled).toBe(false);
        await flush();
        // mount emits beforeMount then onMount as the first two log entries
        expect(events().slice(0, 2)).toEqual(['beforeMount', 'onMount']);
        expect(count('beforeMount')).toBe(1);
        expect(count('onMount')).toBe(1);
        expect(count('onDispose')).toBe(0);
        // numbered entries: first entry id is "1", and renders as "{id}{event}()"
        const firstEntry = logRoot.querySelector('.entry');
        expect(firstEntry?.querySelector('.n')?.textContent).toBe('1');
        expect(firstEntry?.textContent?.replace(/\s+/g, '')).toBe('1beforeMount()');
        // update the (mounted) child -> tick bumps
        await userEvent.click(updateBtn);
        await flush();
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 1');

        // a second update bumps tick to 2
        await userEvent.click(updateBtn);
        await flush();
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 2');

        // unmount the child -> onDispose fires once, placeholder returns
        await userEvent.click(toggle);
        await flush();
        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(root.querySelector('lifecycle-child')).toBeNull();
        expect(root.querySelector('.stage .empty')?.textContent).toBe('child unmounted');
        // Update child disabled again after unmount
        expect(updateBtn.disabled).toBe(true);
        expect(count('onDispose')).toBe(1);
        expect(events()[events().length - 1]).toBe('onDispose');

        // Clear log empties the log and restores the empty placeholder
        await userEvent.click(clearBtn);
        await flush();
        expect(events()).toEqual([]);
        expect(logRoot.querySelector('.empty')?.textContent).toBe(
            'No events yet — mount the child.',
        );

        // remounting after a clear starts a fresh numbered sequence at id 1
        await userEvent.click(toggle);
        await flush();
        expect(logRoot.querySelector('.entry .n')?.textContent).toBe('1');
        expect(events().slice(0, 2)).toEqual(['beforeMount', 'onMount']);

        // leave the log clean for any later consumer
        await userEvent.click(toggle);
        await userEvent.click(clearBtn);
        await flush();
    },
};
