import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { AppDocument } from '#views/Documents/AppDocument';

type Greeting = {
    user: string;
};

// #component
export class HelloWorld extends Component<unknown, Greeting> {
    // #document
    document = AppDocument;

    template = (): Template => tpl`
        <main>
            <h1>Hello, World!</h1>
            <p>${this.viewData.user}</p>
        </main>
    `;
}
