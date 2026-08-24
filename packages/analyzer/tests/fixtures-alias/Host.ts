import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import '#al/Widget';

// #component #tag al-host
export class Host extends Component {
    template = (): Template => tpl`
        <al-widget></al-widget>
        <al-orphan></al-orphan>
    `;
}
