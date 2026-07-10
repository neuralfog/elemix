import { Component, tpl } from '@neuralfog/elemix';
// #component #tag empty-el
export class EmptyEl extends Component {
    template = () => tpl`<div>  <span></span>  <p></p>  <todo-item></todo-item>  </div>`;
}
