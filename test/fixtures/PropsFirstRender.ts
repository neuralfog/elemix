import { Component, defineComponent } from '../../src/component/Component';
import { state } from '../../src/State';
import { html, type Template } from '../../src/types';
import { ref, type Ref } from '../../src/utilities';

type ChildProps = { model: Ref<{ zoom: number }> };

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

defineComponent('props-first-render-child', PropsFirstRenderChild);

export class PropsFirstRenderParent extends Component {
    state = state({ canvas: ref({ zoom: 1 }) });

    template = (): Template => {
        return html`<props-first-render-child
            :model=${this.state.canvas}
        ></props-first-render-child>`;
    };
}

defineComponent('props-first-render-parent', PropsFirstRenderParent);
