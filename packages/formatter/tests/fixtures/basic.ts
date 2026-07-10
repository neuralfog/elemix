import { Component, tpl } from '@neuralfog/elemix';
// #component #tag basic-el
export class Basic extends Component {
    template = () => tpl`
      <div    class="card"   >
    <span>${this.count}</span>
        </div>
    `;
}
