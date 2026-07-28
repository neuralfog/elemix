import type { Component } from '@neuralfog/elemix';
import './env';

export type ViewClass = new () => Component;

interface Renderable {
    $$__ssr(): string;
}

export const renderView = (View: ViewClass): string =>
    (new View() as unknown as Renderable).$$__ssr();
