import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
// Vite compiles the `.scss` and `?inline` hands back the CSS as a string, which
// the instance reassigns to a `#styles` field — so `sheet()` adopts it the same
// way it would an inline `const css = \`…\``. The compiler never sees the import.
import css from './ScssApp.scss?inline';

type State = {
    count: number;
};

// #component
export class ScssApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`
        <div class="card">
            <h2>SCSS styles</h2>
            <p>Imported from a <code>.scss</code> file as <code>?inline</code> and adopted via <code>#styles</code>.</p>
            <button @click=${this.inc}>count is ${this.state.count}</button>
        </div>
    `;
}
