import { Component, tpl } from '@neuralfog/elemix';
// #component #tag nested-blocks
export class NestedBlocks extends Component {
    template = () => tpl`<section><h1>Title</h1><ul><li>one</li><li>two</li></ul></section>`;
}
