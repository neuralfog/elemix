type UnsafeBody = { setHTMLUnsafe(html: string): void };
type NavWindow = Window & { __hydrisNav?: boolean };

const supported = (): boolean => {
    if (typeof document === 'undefined' || document.body == null) return false;
    return (
        typeof (document.body as unknown as Partial<UnsafeBody>)
            .setHTMLUnsafe === 'function'
    );
};

const hard = (url: string): void => {
    window.location.href = url;
};

const bodyInner = (html: string): string => {
    const open = /<body[^>]*>/i.exec(html);
    const start = open ? open.index + open[0].length : -1;
    const end = html.lastIndexOf('</body>');
    return start >= 0 && end > start ? html.slice(start, end) : html;
};

const runScript = (source: HTMLScriptElement): Promise<void> =>
    new Promise<void>((resolve) => {
        const script = document.createElement('script');
        for (const attr of Array.from(source.attributes)) {
            script.setAttribute(attr.name, attr.value);
        }
        script.textContent = source.textContent;
        if (source.src) {
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', () => resolve());
            source.replaceWith(script);
        } else {
            source.replaceWith(script);
            resolve();
        }
    });

const isModule = (s: HTMLScriptElement): boolean =>
    s.type === 'module' || Boolean(s.src);

const cloneForHead = (el: Element): Node => {
    if (el.tagName === 'SCRIPT') {
        const script = document.createElement('script');
        for (const attr of Array.from(el.attributes)) {
            script.setAttribute(attr.name, attr.value);
        }
        script.textContent = el.textContent;
        return script;
    }
    return document.importNode(el, true);
};

const mergeHead = (incoming: HTMLHeadElement): void => {
    const current = document.head;

    const title = incoming.querySelector('title');
    if (title) document.title = title.textContent ?? document.title;

    const incomingEls = Array.from(incoming.children).filter(
        (el) => el.tagName !== 'TITLE',
    );
    const incomingKeys = new Set(incomingEls.map((el) => el.outerHTML));
    const currentKeys = new Set(
        Array.from(current.children).map((el) => el.outerHTML),
    );

    for (const el of Array.from(current.children)) {
        if (el.tagName === 'TITLE') continue;
        if (!incomingKeys.has(el.outerHTML)) el.remove();
    }
    for (const el of incomingEls) {
        if (!currentKeys.has(el.outerHTML)) {
            current.appendChild(cloneForHead(el));
        }
    }
};

let inflight: AbortController | undefined;

const swap = async (html: string): Promise<void> => {
    const incoming = new DOMParser().parseFromString(html, 'text/html');
    mergeHead(incoming.head);

    (document.body as unknown as UnsafeBody).setHTMLUnsafe(bodyInner(html));

    const scripts = Array.from(
        document.body.querySelectorAll<HTMLScriptElement>('script'),
    );
    for (const s of scripts) if (!isModule(s)) await runScript(s);
    for (const s of scripts) if (isModule(s)) await runScript(s);
};

const run = async (url: string, push: boolean): Promise<void> => {
    inflight?.abort();
    const controller = new AbortController();
    inflight = controller;

    let html: string;
    let target = url;
    try {
        const res = await fetch(url, {
            headers: { 'x-hydris-nav': '1' },
            credentials: 'same-origin',
            signal: controller.signal,
        });
        const type = res.headers.get('content-type') ?? '';
        if (!type.includes('text/html')) return hard(url);
        target = res.url || url;
        if (new URL(target).origin !== location.origin) return hard(url);
        html = await res.text();
    } catch {
        if (controller.signal.aborted) return;
        return hard(url);
    }
    if (controller.signal.aborted) return;

    if (push) history.pushState(null, '', target);
    else if (target !== location.href) history.replaceState(null, '', target);
    try {
        await swap(html);
    } catch {
        return hard(target);
    }
    if (push) window.scrollTo(0, 0);
};

export const navigate = (to: string): void => {
    if (typeof window === 'undefined') return;
    const url = new URL(to, location.href);
    if (!supported() || url.origin !== location.origin) {
        window.location.href = url.href;
        return;
    }
    void run(url.href, url.href !== location.href);
};

if (typeof window !== 'undefined' && supported()) {
    const w = window as NavWindow;
    if (!w.__hydrisNav) {
        w.__hydrisNav = true;
        history.scrollRestoration = 'manual';
        window.addEventListener('popstate', () => {
            void run(location.href, false);
        });
    }
}
