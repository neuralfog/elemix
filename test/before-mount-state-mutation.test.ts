import { expect, test, describe, beforeEach } from 'vitest';
import { Component } from '../src/component/Component';
import { component } from '../src/decorators/component';
import { state } from '../src/decorators/state';
import { html, type Template } from '../src/types';
import { present } from '../testing';
import { render } from '../utilities';

@component()
class SwitchLikeComponent extends Component {
    @state()
    state = { checked: false };

    public attachCount = 0;

    beforeMount(): void {
        this.attachCount++;
        this.state.checked = this.hasAttribute('checked');
    }

    template = (): Template => html`
        <span
            class=${this.state.checked ? 'is-on' : 'is-off'}
            >${this.state.checked ? 'ON' : 'OFF'}</span
        >
    `;
}

describe('beforeMount mutating @state', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('default — renders OFF', async () => {
        const presenter = present().screen(
            html`<switch-like-component></switch-like-component>`,
        );
        await render();
        const el = presenter.root<SwitchLikeComponent>();
        expect(el.attachCount).toBe(1);
        expect(el.root?.querySelector('.is-off')?.textContent).toBe('OFF');
    });

    test('with checked attr — renders ON after beforeMount mutation', async () => {
        const presenter = present().screen(
            html`<switch-like-component checked></switch-like-component>`,
        );
        await render();
        const el = presenter.root<SwitchLikeComponent>();
        expect(el.attachCount).toBe(1);
        expect(el.root?.querySelector('.is-on')?.textContent).toBe('ON');
    });

    test('with parent passing :checked, :disabled, :onChange — renders correctly', async () => {
        @component()
        class SwitchParent extends Component {
            template = (): Template => html`
                <switch-like-with-props
                    :checked=${true}
                    :disabled=${false}
                    :onChange=${() => {}}
                ></switch-like-with-props>
            `;
        }
        @component()
        class SwitchLikeWithProps extends Component<{
            checked?: boolean;
            disabled?: boolean;
            onChange?: (v: boolean) => void;
        }> {
            @state()
            state = { checked: false };

            beforeMount(): void {
                this.state.checked = this.hasAttribute('checked');
            }

            private get isChecked(): boolean {
                return this.props.checked ?? this.state.checked;
            }

            template = (): Template => html`
                <span
                    class=${this.isChecked ? 'is-on' : 'is-off'}
                    >${this.isChecked ? 'ON' : 'OFF'}</span
                >
            `;
        }
        // satisfy lint
        void SwitchParent;
        void SwitchLikeWithProps;
        const presenter = present().screen(
            html`<switch-parent></switch-parent>`,
        );
        await render();
        const root = presenter.root();
        const child = root.shadowRoot?.querySelector(
            'switch-like-with-props',
        ) as SwitchLikeWithProps | null;
        expect(child).toBeTruthy();
        expect(child?.root?.querySelector('.is-on')?.textContent).toBe('ON');
    });
});
