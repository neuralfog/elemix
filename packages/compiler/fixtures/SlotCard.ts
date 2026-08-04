import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SlotChip';
import './SlotItem';
import './SlotPanel';

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .card {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 520px;
        padding: 28px;
        border-radius: 20px;
        background: linear-gradient(180deg, #f8fafc, #eef2ff);
    }
`;

// #component
export class SlotCard extends Component {
    // #styles
    styles = css;

    template = (): Template => tpl`
        <div class="card">
            <slot-item :title=${'Group One'}>
                <slot-panel>
                    <slot-chip :label=${'Alpha'}></slot-chip>
                    <slot-chip :label=${'Beta'}></slot-chip>
                    <slot-chip :label=${'Gamma'}></slot-chip>
                </slot-panel>
            </slot-item>
            <slot-item :title=${'Group Two'}>
                <slot-panel>
                    <slot-chip :label=${'Delta'}></slot-chip>
                    <slot-chip :label=${'Epsilon'}></slot-chip>
                    <slot-chip :label=${'Zeta'}></slot-chip>
                </slot-panel>
            </slot-item>
        </div>
    `;
}
