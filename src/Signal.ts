import { Reactive } from './Reactive';
import { RenderTrigger } from './types';

export const signal = <State>(
    state: State,
    renderTrigger?: string,
): Reactive<State> =>
    new Reactive(state, renderTrigger || RenderTrigger.SIGNAL);
