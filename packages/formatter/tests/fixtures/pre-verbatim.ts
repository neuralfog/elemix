import { Component, tpl } from '@neuralfog/elemix';
// #component #tag pre-block
export class PreBlock extends Component {
    template = () => tpl`<div><pre>  line one
    line two indented
  line three</pre></div>`;
}
