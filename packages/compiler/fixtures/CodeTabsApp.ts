import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class CodeTabsApp extends Component {
    // #state
    state = { tab: 'ts' };

    show = (tab: string): void => {
        this.state.tab = tab;
    };

    template = (): Template => tpl`
        <div class="tabs">
            <button id="to-ts" @click=${() => this.show('ts')}>ts</button>
            <button id="to-scss" @click=${() => this.show('scss')}>scss</button>
            <pre
                id="panel-ts"
                class=${this.state.tab === 'ts' ? 'panel' : 'panel hidden'}
            ><code><span class="k">import</span> x <span class="k">from</span> <span class="s">'y'</span>;
<span class="c">// #state</span>
    count = <span class="n">0</span>;</code></pre>
            <pre
                id="panel-scss"
                class=${this.state.tab === 'scss' ? 'panel' : 'panel hidden'}
            ><code><span class="t">button</span> {
    color: <span class="n">#fff</span>;
}</code></pre>
        </div>
    `;
}
