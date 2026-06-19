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

        // lifecycle hooks log into the log-view child's own shadow root
        const logView = root.querySelector('log-view');
        const logRoot = logView?.shadowRoot;
        if (!logRoot) throw new Error('lifecycle-app missing log-view shadow root');

        // Each entry renders as "{id}{event}()" — pull the event back out (strip
        // the leading id digits and the trailing "()"). Works for any event name.
        const events = (): string[] =>
            Array.from(logRoot.querySelectorAll('.entry')).map((e) =>
                (e.textContent ?? '')
                    .replace(/\s+/g, '')
                    .replace(/^\d+/, '')
                    .replace(/\(\)$/, ''),
            );
        const count = (name: string): number =>
            events().filter((e) => e === name).length;
        // the #effects append their firing order onto the child host's data-fx
        const fx = (): string =>
            root.querySelector('lifecycle-child')?.getAttribute('data-fx') ?? '';
        // lifecycle records flush on a microtask before they reach the log
        const flush = (): Promise<void> =>
            new Promise((r) => setTimeout(r, 0));

        // start from a clean log regardless of prior story state
        await userEvent.click(clearBtn);
        await flush();

        // initial: child unmounted, nothing logged yet
        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(root.querySelector('lifecycle-child')).toBeNull();
        expect(updateBtn.disabled).toBe(true);
        expect(events()).toEqual([]);

        // ── MOUNT ──────────────────────────────────────────────────────────
        // Lifecycle log proves multiple #before-mount then multiple #mount fire,
        // each group in SOURCE ORDER, and beforeMount comes before onMount.
        await userEvent.click(toggle);
        await flush();
        expect(toggle.textContent?.trim()).toBe('Unmount');
        expect(root.querySelector('lifecycle-child')).not.toBeNull();
        expect(events()).toEqual(['before-1', 'before-2', 'mount-1', 'mount-2']);
        for (const e of ['before-1', 'before-2', 'mount-1', 'mount-2']) {
            expect(count(e)).toBe(1);
        }
        // both #effects fired once at mount, in source order (A before B), tick 0
        expect(fx()).toBe('A0B0');
        expect(updateBtn.disabled).toBe(false);
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 0');

        // ── UPDATE (tick 0 → 1) ────────────────────────────────────────────
        // Only the two #effects re-fire (they read tick); both, in source order.
        // No lifecycle hook re-runs.
        const logLen = events().length;
        await userEvent.click(updateBtn);
        await flush();
        expect(fx()).toBe('A0B0A1B1');
        expect(events().length).toBe(logLen); // no new lifecycle entries
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 1');

        // ── UPDATE (tick 1 → 2) ────────────────────────────────────────────
        await userEvent.click(updateBtn);
        await flush();
        expect(fx()).toBe('A0B0A1B1A2B2');
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 2');

        // ── UNMOUNT ────────────────────────────────────────────────────────
        // Both #dispose handlers fire, in source order, and nothing else.
        const mark = events().length;
        await userEvent.click(toggle);
        await flush();
        expect(toggle.textContent?.trim()).toBe('Mount');
        expect(root.querySelector('lifecycle-child')).toBeNull();
        expect(updateBtn.disabled).toBe(true);
        expect(events().slice(mark)).toEqual(['dispose-1', 'dispose-2']);
        expect(count('dispose-1')).toBe(1);
        expect(count('dispose-2')).toBe(1);

        // ── REMOUNT after clear ────────────────────────────────────────────
        // A fresh mount replays the lifecycle sequence (ids restart at 1). The
        // new host's effects fire against the CURRENT tick (still 2 — unmounting
        // doesn't reset it), so its own data-fx starts at A2B2.
        await userEvent.click(clearBtn);
        await flush();
        expect(events()).toEqual([]);
        await userEvent.click(toggle);
        await flush();
        expect(logRoot.querySelector('.entry .n')?.textContent).toBe('1');
        expect(events()).toEqual(['before-1', 'before-2', 'mount-1', 'mount-2']);
        expect(
            root.querySelector('lifecycle-child')?.shadowRoot?.querySelector('.child')
                ?.textContent,
        ).toBe('Child · tick 2');
        expect(fx()).toBe('A2B2');

        // leave the log clean for any later consumer
        await userEvent.click(toggle);
        await userEvent.click(clearBtn);
        await flush();
    },
};
