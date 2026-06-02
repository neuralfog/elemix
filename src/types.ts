import { html as rhtml } from './renderer/render';
import type { HtmlTemplate } from './renderer/types';

export type Template = HtmlTemplate;
export const html = rhtml;

export const RenderTrigger = {
    PROPS: 'PROPS',
    SIGNAL: 'SIGNAL',
    LOCAL_STATE: 'LOCAL_STATE',
    ON_MOUNT: 'ON_MOUNT',
} as const;

export type RenderTriggerType =
    | (typeof RenderTrigger)[keyof typeof RenderTrigger]
    | string;
