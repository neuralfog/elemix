import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    title: string;
    subtitle?: string;
};

// #component #tag info-card
export class InfoCard extends Component<Props> {
    template = (): Template => tpl`<div>${this.props.title}</div>`;
}

// #component #tag required-app
export class RequiredApp extends Component {
    template = (): Template => tpl`
        <info-card :subtitle=${'x'}></info-card>
        <info-card :title=${'hello'}></info-card>
        <info-card></info-card>
    `;
}
