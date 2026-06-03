import { render } from '../renderer/render';
import type { Template } from './types';
import { query } from './shadowRoot';

export type Presenter = {
    screen(template: Template): Presenter;
    body(): HTMLElement;
    root<Component extends HTMLElement>(): Component;
    getComponent<Component extends HTMLElement>(tag: string): Component;
};

export const present = (): Presenter => {
    const presenter: Presenter = {
        screen(template: Template): Presenter {
            render(template, document.body);
            return presenter;
        },

        body(): HTMLElement {
            return document.body;
        },

        root<Component extends HTMLElement>(): Component {
            return document.body.firstElementChild as Component;
        },

        getComponent<Component extends HTMLElement>(tag: string): Component {
            return query(document.body, tag) as Component;
        },
    };

    return presenter;
};
