import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';

export const MOCK_CSS = `.styles { color: 'green'; }`;

@component({ tag: 'styled-app', styles: [MOCK_CSS] })
export class StyledApp extends Component {
    template = (): Template => {
        return html` <h1>StyledApp</h1> `;
    };
}
