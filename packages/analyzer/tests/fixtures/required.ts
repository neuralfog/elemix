import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    title: string; // required
    subtitle?: string; // optional
};

// #component #tag info-card
export class InfoCard extends Component<Props> {
    template = (): Template => tpl`<div>${this.props.title}</div>`;
}

// #component #tag required-app
export class RequiredApp extends Component {
    // 1) omits the REQUIRED `title` (only optional `subtitle`) → ERROR.
    // 2) provides `title`, omits the OPTIONAL `subtitle` → CLEAN.
    // 3) a zero-prop usage — every required prop missing → ERROR (exhaustive).
    template = (): Template => tpl`
        <info-card :subtitle=${'x'}></info-card>
        <info-card :title=${'hello'}></info-card>
        <info-card></info-card>
    `;
}
