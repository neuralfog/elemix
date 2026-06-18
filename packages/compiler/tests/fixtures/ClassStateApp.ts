import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

class Item {
    id: string;
    name: string;
    price: number;
    qty: number;

    constructor(id: string, name: string, price: number, qty: number) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.qty = qty;
    }

    get lineTotal(): number {
        return this.price * this.qty;
    }

    bump(): void {
        this.qty++;
    }
}

class Cart {
    items: Item[] = [
        new Item('p1', 'apple', 2, 2),
        new Item('p2', 'banana', 1, 3),
    ];
    coupon = 0;

    get count(): number {
        return this.items.length;
    }

    get subtotal(): number {
        return this.items.reduce((sum, item) => sum + item.lineTotal, 0);
    }

    get total(): number {
        return this.subtotal - this.coupon;
    }

    add(item: Item): void {
        this.items.push(item);
    }

    remove(id: string): void {
        const index = this.items.findIndex((item) => item.id === id);
        if (index !== -1) this.items.splice(index, 1);
    }

    clear(): void {
        this.items.splice(0, this.items.length);
        this.coupon = 0;
    }
}

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class ClassStateApp extends Component {
    // #styles
    styles = css;

    // #state
    state: { cart: Cart } = { cart: new Cart() };

    addCherry = (): void => {
        this.state.cart.add(new Item('p3', 'cherry', 5, 1));
    };

    bumpApple = (): void => {
        const apple = this.state.cart.items.find((item) => item.id === 'p1');
        apple?.bump();
    };

    applyCoupon = (): void => {
        this.state.cart.coupon = 3;
    };

    removeBanana = (): void => {
        this.state.cart.remove('p2');
    };

    clearCart = (): void => {
        this.state.cart.clear();
    };

    template = (): Template => tpl`
        <section class="summary">
            <span class="count">${this.state.cart.count}</span>
            <span class="subtotal">${this.state.cart.subtotal}</span>
            <span class="coupon">${this.state.cart.coupon}</span>
            <span class="total">${this.state.cart.total}</span>
        </section>
        <div class="controls">
            <button class="add" @click=${this.addCherry}>add</button>
            <button class="bump" @click=${this.bumpApple}>bump</button>
            <button class="coupon-btn" @click=${this.applyCoupon}>coupon</button>
            <button class="remove" @click=${this.removeBanana}>remove</button>
            <button class="clear" @click=${this.clearCart}>clear</button>
        </div>
        <ul class="items">
            ${repeat(
                this.state.cart.items,
                (item) => tpl`
                    <li class="item">
                        <span class="name">${item.name}</span>
                        <span class="qty">${item.qty}</span>
                        <span class="line">${item.lineTotal}</span>
                    </li>
                `,
                (item) => item.id,
            )}
        </ul>
    `;
}
