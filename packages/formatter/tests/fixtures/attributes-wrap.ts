import { Component, tpl } from '@neuralfog/elemix';
// #component #tag attr-wrap
export class AttrWrap extends Component {
    template = () => tpl`
        <input class="input" type="text" placeholder="What needs doing today?" name="draft" autocomplete="off" />
    `;
}
