import { Reactive } from './Reactive';

export const state = <State>(initial: State): State =>
    new Reactive<State>(initial).value;
