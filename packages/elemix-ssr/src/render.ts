import './env';
import {
    $__render,
    $__runStores,
    $__setStores,
    $__setViewData,
    type Rope,
} from '@neuralfog/elemix/ssr-runtime';
import {
    applyResetToSsr,
    resetConfigScript,
    resetDocumentStyle,
} from './reset';

type SsrView = {
    $$__attachFormInternals?(): void;
    $$__beforeMount?(): void;
    $$__ssr(): Rope;
};

type ViewClass = (new () => SsrView) & { $$__document?: ViewClass };

type RenderContext = { viewData?: unknown; stores?: Record<string, unknown> };

const OUTLET = '<slot></slot>';

const island = (id: string, data: unknown): string =>
    `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const renderOne = (View: ViewClass): string => {
    const view = new View();
    view.$$__attachFormInternals?.();
    view.$$__beforeMount?.();
    return $__render(view.$$__ssr());
};

const outletIndex = (html: string): number => {
    let depth = 0;
    let i = 0;
    while (i < html.length) {
        if (depth === 0 && html.startsWith(OUTLET, i)) return i;
        if (html.startsWith('<template', i)) {
            depth++;
            i += 9;
            continue;
        }
        if (html.startsWith('</template>', i)) {
            if (depth > 0) depth--;
            i += 11;
            continue;
        }
        i++;
    }
    return -1;
};

const compose = (frame: string, inner: string): string => {
    const outlet = outletIndex(frame);
    if (outlet >= 0) {
        return (
            frame.slice(0, outlet) + inner + frame.slice(outlet + OUTLET.length)
        );
    }
    if (frame.includes('</body>')) {
        return frame.replace('</body>', `${inner}</body>`);
    }
    return frame + inner;
};

export const render = (View: ViewClass, ctx?: RenderContext): string =>
    $__runStores(() => {
        const stores = ctx?.stores ?? {};
        $__setViewData(ctx?.viewData);
        $__setStores(stores);
        const page = renderOne(View);
        let inner = island('__hydris_stores', stores) + page;
        if (ctx?.viewData !== undefined)
            inner = island('__elemix_vd', ctx.viewData) + inner;
        inner = resetConfigScript() + resetDocumentStyle() + inner;
        const Document = View.$$__document;
        return applyResetToSsr(
            Document ? compose(renderOne(Document), inner) : inner,
        );
    });
