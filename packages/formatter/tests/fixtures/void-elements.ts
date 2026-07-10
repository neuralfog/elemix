import { Component, tpl } from '@neuralfog/elemix';
// #component #tag void-el
export class VoidEl extends Component {
    template = () => tpl`<div><img src="a.png" alt="a"><br><hr></div>`;
}
