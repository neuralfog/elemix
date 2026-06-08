import { html as rhtml } from './renderer/render';
import type { HtmlTemplate } from './renderer/types';

export type Template = HtmlTemplate;
export const html = rhtml;
