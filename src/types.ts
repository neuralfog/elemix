import { type HtmlTemplate, html as rhtml } from '@neuralfog/elemix-renderer';

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
