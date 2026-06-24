import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag bind-card
export class BindCard extends Component {
    onClick = (e: Event): void => {
        void e;
    };
    onKey = (e: KeyboardEvent): void => {
        void e;
    };
    box: { value: Element | null } = { value: null };
    field = { value: '' };

    // For each binding the first usage is valid, the second wrong:
    //   @event    → handler typed per the DOM event (click → PointerEvent, etc.)
    //   :ref      → { value }
    //   ~model    → { value: string }
    //   ~onmodel  → (value: string) => string
    template = (): Template => tpl`
        <div @click=${this.onClick}>ok</div>
        <div @click=${42}>bad</div>
        <input @keydown=${this.onKey} />
        <div @click=${this.onKey}>wrong event type</div>
        <div :ref=${this.box}></div>
        <div :ref=${42}></div>
        <input ~model=${this.field} />
        <input ~model=${{ value: 0 }} />
        <input ~onmodel=${(v: string) => v.toUpperCase()} />
        <input ~onmodel=${42} />
    `;
}
