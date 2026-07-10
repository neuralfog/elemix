import { ref, tpl } from '@neuralfog/elemix';
import './card';

// A free-standing template (a module export, NOT a component's `template`
// member) exercising the whole binding surface against module scope with no
// `this`: a `#state` store read, a `~model`, an `@event`, and `:prop`s.
// #state
export const store = { name: ref('Ada'), count: 0 };

const onClick = (_ev: MouseEvent): void => {};

// Two holes are wrong on purpose (name wants string, count wants number); every
// other binding is valid — the analyzer must flag exactly the two bad props.
export const render = () => tpl`
    <input type="text" ~model=${store.name} @click=${onClick} />
    <user-card :name=${store.name.value} :count=${store.count}></user-card>
    <user-card :name=${42} :count=${'nope'}></user-card>
`;
