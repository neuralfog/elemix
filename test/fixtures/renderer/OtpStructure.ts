import { Component } from '../../../src/component/Component';
import { component } from '../../../src/decorators/component';
import { state } from '../../../src/State';
import { repeat } from '../../../directives';
import { ref } from '../../../src/utilities';
import { html, type Template } from '../../../src/types';

const DIGITS = 6;

type Digit = { id: string; value: string };

/**
 * Repeated list whose item template is a wrapper <div> with `.class={...}`
 * directive containing a self-closing <input ... /> followed by a sibling
 * <div class="otp-dot">.
 *
 * The covered edge: the <input ... /> sits between the wrapper's opening tag
 * and a sibling <div>. The renderer must keep the trailing sibling <div>
 * inside the wrapper, not promote it to a sibling of the wrapper itself.
 */
@component()
export class OtpLikeStructure extends Component {
    state = state({
        digits: Array.from(
            { length: DIGITS },
            (_, i): Digit => ({ id: String(i), value: '' }),
        ),
    });

    public inputRefs = Array.from({ length: DIGITS }, () =>
        ref<HTMLInputElement>(),
    );

    private onInput = (_index: number, _e: Event): void => {};
    private onKeyDown = (_index: number, _e: KeyboardEvent): void => {};
    private onBeforeInput = (_e: InputEvent): void => {};
    private onPaste = (_e: ClipboardEvent): void => {};

    template = (): Template => html`
        <div class="otp-digits">
            ${repeat(
                this.state.digits,
                (digit) => html`
                    <div
                        .class=${{
                            'otp-digit-wrapper': true,
                            filled: !!digit.value,
                        }}
                    >
                        <input
                            class="otp-digit"
                            type="text"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="1"
                            .value=${digit.value}
                            :ref=${this.inputRefs[Number(digit.id)]}
                            @beforeinput=${this.onBeforeInput}
                            @input=${(e: Event) =>
                                this.onInput(Number(digit.id), e)}
                            @keydown=${(e: KeyboardEvent) =>
                                this.onKeyDown(Number(digit.id), e)}
                            @paste=${this.onPaste}
                        />
                        <div class="otp-dot"></div>
                    </div>
                `,
                (digit) => digit.id,
            )}
        </div>
    `;
}
