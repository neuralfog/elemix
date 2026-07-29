import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { phase: string; ticks: number };

// #component
export class AsyncApp extends Component {
    // #state
    state: State = { phase: 'init', ticks: 0 };

    // #before-mount
    async prepare(): Promise<void> {
        this.setAttribute('data-prepared', 'sync');
        await Promise.resolve();
        this.setAttribute('data-prepared', 'async');
    }

    // #mount
    async load(): Promise<void> {
        this.state.phase = 'loading';
        await Promise.resolve();
        this.state.phase = 'ready';
    }

    // #effect
    async mirror(): Promise<void> {
        const phase = this.state.phase;
        await Promise.resolve();
        this.setAttribute('data-phase', phase);
    }

    bump = (): void => {
        this.state.ticks++;
    };

    // #dispose
    async teardown(): Promise<void> {
        await Promise.resolve();
        this.removeAttribute('data-phase');
    }

    template = (): Template => tpl`
        <div class="async">
            <span class="phase">${this.state.phase}</span>
            <span class="ticks">${this.state.ticks}</span>
            <button class="bump" @click=${this.bump}>+1</button>
        </div>
    `;
}
