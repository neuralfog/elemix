import type { Component } from '@neuralfog/elemix';
import {
    $__render,
    $__runStores,
    $__setViewData,
    type Rope,
} from '@neuralfog/elemix/ssr-runtime';
import './env';

export type ViewClass = new () => Component;

let defaultDocument: ViewClass | undefined;
let documentLocked = false;

export const setDefaultDocument = (document: ViewClass | undefined): void => {
    if (documentLocked) {
        throw new Error(
            'App.document() must be called before App.serve(); the default document is locked once the server boots.',
        );
    }
    defaultDocument = document;
};

export const lockDefaultDocument = (): void => {
    documentLocked = true;
};

export const getDefaultDocument = (): ViewClass | undefined => defaultDocument;

type Renderable = {
    $$__attachFormInternals?(): void;
    $$__beforeMount?(): void;
    $$__ssr(): Rope;
};

export const renderView = (View: ViewClass, data?: unknown): string =>
    $__runStores(() => {
        $__setViewData(data);
        const view = new View() as unknown as Renderable;
        if (!(View as { $$__client?: boolean }).$$__client) {
            view.$$__attachFormInternals?.();
            view.$$__beforeMount?.();
        }
        return $__render(view.$$__ssr());
    });
