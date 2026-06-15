import { Component, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { qty: number; price: number };

const css = `
    :host {
        display: inline-flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        font-family: system-ui, sans-serif;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        width: 200px;
    }
    .row { display: flex; justify-content: space-between; align-items: center; }
    button {
        font: inherit;
        padding: 4px 10px;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    .num { font-weight: 700; color: #1e293b; }
    .total { color: #6366f1; }
`;

// Proof that elemix needs no `computed()`: a derived value is just a getter.
// Reading `subtotal`/`total` inside the template effect transitively reads the
// tracked `state`, so the effect subscribes and the getters re-evaluate on any
// change — no memo primitive, no `.value`, nothing. `total` even derives from
// another getter (`subtotal`), proving chained derivation works the same way.
`#component #styles ${css}`
export class DerivedApp extends Component {
    state = state<State>({ qty: 2, price: 10 });

    get subtotal(): number {
        return this.state.qty * this.state.price;
    }

    get total(): number {
        return Math.round(this.subtotal * 1.2);
    }

    addQty = (): void => {
        this.state.qty++;
    };

    bumpPrice = (): void => {
        this.state.price += 5;
    };

    template = (): Template => tpl`<div>
        <div class="row">
            <button class="add-qty" @click=${this.addQty}>qty +1</button>
            <span class="num qty">${this.state.qty}</span>
        </div>
        <div class="row">
            <button class="bump-price" @click=${this.bumpPrice}>price +5</button>
            <span class="num price">${this.state.price}</span>
        </div>
        <div class="row"><span>subtotal</span><span class="num subtotal">${this.subtotal}</span></div>
        <div class="row"><span>total +20%</span><span class="num total">${this.total}</span></div>
    </div>`;
}
