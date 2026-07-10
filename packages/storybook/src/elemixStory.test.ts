import type { StoryObj } from '@storybook/html-vite';
import { expectTypeOf, test } from 'vitest';
import type { ElemixStory } from './elemixStory';

test('ElemixStory exposes every base StoryObj property', () => {
    type Missing = Exclude<keyof StoryObj, keyof ElemixStory>;
    expectTypeOf<Missing>().toEqualTypeOf<never>();
});

test('inherited base props are assignable on an ElemixStory', () => {
    const story: ElemixStory = {
        name: 'Example',
        tags: ['autodocs'],
        args: {},
        argTypes: {},
        globals: {},
        decorators: [],
        loaders: [],
        parameters: {
            elemix: { beforeRender: () => {}, afterRender: () => {} },
        },
        render: () => '<p>x</p>',
        beforeEach: () => {},
        play: () => {},
    };

    expectTypeOf(story.play).not.toBeNever();
    expectTypeOf(story.beforeEach).not.toBeNever();
    expectTypeOf(story.decorators).not.toBeNever();
    expectTypeOf(story.loaders).not.toBeNever();
    expectTypeOf(story.globals).not.toBeNever();
});
