import type { Template } from './types';
import { uncompiled } from './uncompiled';

export const tpl = (
    _strings: TemplateStringsArray,
    ..._values: unknown[]
): Template => uncompiled('tpl');
