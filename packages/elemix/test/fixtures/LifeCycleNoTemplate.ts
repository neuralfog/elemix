import { Component, defineComponent } from '../../src/component/Component';

export class LifeCycleNoTemplate extends Component {
    onMount = (): void => {};
}

defineComponent('life-cycle-no-template', LifeCycleNoTemplate);
