import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
// #component #tag nested-tpl
export class NestedTpl extends Component {
    template = () => tpl`
      <ul class="list">
    ${repeat(
                this.state.rows,
                (row) => tpl`
                    <li class="row">${row.label}</li>
                `,
                (row) => row.id,
            )}
    </ul>
    `;
}
