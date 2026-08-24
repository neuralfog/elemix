import { ref, tpl } from '@neuralfog/elemix';
import './card';

// #state
export const store = { name: ref('Ada'), count: 0 };

const onClick = (_ev: MouseEvent): void => {};

export const render = () => tpl`
    <input type="text" ~model=${store.name} @click=${onClick} />
    <user-card :name=${store.name.value} :count=${store.count}></user-card>
    <user-card :name=${42} :count=${'nope'}></user-card>
`;
