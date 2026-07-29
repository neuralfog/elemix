import type { Component } from '@neuralfog/elemix';
import { $__runStores, $__setViewData } from '@neuralfog/elemix/ssr-runtime';
import './env';

export type ViewClass = new () => Component;

interface Renderable {
    $$__attachFormInternals?(): void;
    $$__beforeMount?(): void;
    $$__ssr(): string;
}

export const renderView = (View: ViewClass, data?: unknown): string =>
    $__runStores(() => {
        $__setViewData(data);
        const view = new View() as unknown as Renderable;
        if (!(View as { $$__client?: boolean }).$$__client) {
            view.$$__attachFormInternals?.();
            view.$$__beforeMount?.();
        }
        return view.$$__ssr();
    });
