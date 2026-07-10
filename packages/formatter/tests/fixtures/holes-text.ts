import { Component, tpl } from '@neuralfog/elemix';
// #component #tag holes-text
export class HolesText extends Component {
    template = () => tpl`
            <p>count is ${this.state.count}   of    ${this.state.total}</p>
    `;
}
