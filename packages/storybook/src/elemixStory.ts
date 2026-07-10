import type { Template } from '@neuralfog/elemix/types';
import type {
    Meta,
    Parameters,
    StoryContext,
    StoryObj,
} from '@storybook/html-vite';

export type ElemixParams<TArgs = Record<string, never>> = {
    beforeRender?: (ctx: StoryContext<TArgs>) => void;
    afterRender?: (ctx: StoryContext<TArgs>) => void;
};

export type ElemixStoryParameters<TArgs = Record<string, never>> =
    Parameters & {
        elemix?: ElemixParams<TArgs>;
    };

export type ElemixStoryFn<TArgs = Record<string, never>> = (
    args: TArgs,
    context: StoryContext<TArgs>,
) => string | Node | Template;

export type ElemixStory<TArgs = Record<string, never>> = Omit<
    StoryObj<TArgs>,
    'render' | 'parameters'
> & {
    render: ElemixStoryFn<TArgs>;
    parameters?: ElemixStoryParameters<TArgs>;
};

export type ElemixMeta<TArgs = Record<string, never>> = Omit<
    Meta<TArgs>,
    'parameters'
> & {
    parameters?: ElemixStoryParameters<TArgs>;
};
