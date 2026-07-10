import { Component, tpl } from '@neuralfog/elemix';
// #component #tag multi-root
export class MultiRoot extends Component {
    template = () => tpl`<theme-switch/>   <todo-app></todo-app>`;
}
