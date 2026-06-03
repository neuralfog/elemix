import { Component } from '../../src/component/Component';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { html, type Template } from '../../src/types';
import { ref, type Ref } from '../../src/utilities';

type ChildProps = { model: Ref<{ zoom: number }> };

@component()
export class PropsFirstRenderChild extends Component<ChildProps> {
    public beforeMountSawModel = false;
    public templateSawModel = false;

    beforeMount(): void {
        this.beforeMountSawModel = this.props.model?.value?.zoom === 1;
    }

    template = (): Template => {
        this.templateSawModel = this.props.model?.value?.zoom === 1;
        return html`<span class="zoom">${this.props.model.value.zoom}</span>`;
    };
}

@component()
export class PropsFirstRenderParent extends Component {
    @state()
    state = { canvas: ref({ zoom: 1 }) };

    template = (): Template => {
        return html`<props-first-render-child
            :model=${this.state.canvas}
        ></props-first-render-child>`;
    };
}
