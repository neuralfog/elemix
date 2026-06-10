import type {
    StoryContext,
    Parameters,
    Meta,
} from '@storybook/web-components-vite';

export type ElemixTeardown = () => void;

export type ElemixParams<TArgs = Record<string, never>> = {
    setup?: (ctx: StoryContext<TArgs>) => ElemixTeardown | undefined;
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
) => string | Node;

export type ElemixStory<TArgs = Record<string, never>> = {
    render: ElemixStoryFn<TArgs>;
    args?: Partial<TArgs>;
    argTypes?: Record<string, unknown>;
    parameters?: ElemixStoryParameters<TArgs>;
};

export type ElemixMeta<TArgs = Record<string, never>> = Omit<
    Meta<TArgs>,
    'parameters'
> & {
    parameters?: Parameters & {
        elemix?: ElemixParams<TArgs>;
    };
};
