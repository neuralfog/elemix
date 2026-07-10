import { Component, tpl } from '@neuralfog/elemix';
// #component #tag touching-inline
export class TouchingInline extends Component {
    template = () => tpl`
        <p>See the module (<code>SignalStore.ts</code>) for how the reactive store is created and then wired up.</p>
    `;
}
