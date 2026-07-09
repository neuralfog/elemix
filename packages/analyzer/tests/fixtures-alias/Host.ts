import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// `al-widget` is imported through the `#al/*` tsconfig alias (a side-effect
// import). `al-orphan` is never imported, so only it should warn.
import '#al/Widget';

// #component #tag al-host
export class Host extends Component {
    template = (): Template => tpl`
        <al-widget></al-widget>
        <al-orphan></al-orphan>
    `;
}
