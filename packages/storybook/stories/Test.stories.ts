import { html } from '@neuralfog/elemix';
import type { ElemixMeta, ElemixStory } from '../src/elemixStory';

type HelloArgs = { text: string };

const meta: ElemixMeta<HelloArgs> = {
    title: 'Test/Hello',
    parameters: {
        elemix: {
            beforeRender: () => {},
            afterRender: () => {},
            setup: () => {
                return () => {};
            },
        },
    },
    args: {
        text: 'There',
    },
    argTypes: {
        text: { control: 'text' },
    },
};

export default meta;

export const Default: ElemixStory<HelloArgs> = {
    render: (args) => {
        return html`<div>Hello ${args.text}</div>`;
    },
};
