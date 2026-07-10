import { Component, tpl } from '@neuralfog/elemix';
// #component #tag with-comments
export class WithComments extends Component {
    template = () => tpl`<div><!--   the header   --><h1>Hi</h1></div>`;
}
