# Local State

Mark a component field with the `#state` hint to make it reactive. State can be a
primitive or an object — reads inside a template subscribe automatically, and
mutations re-run only the bindings that touched them.

```elemix
import { Component, tpl } from '@neuralfog/elemix';

// #component
export class MyCounter extends Component {
    // #state
    count = 0;

    inc = (): void => {
        this.count++;
    };

    template = () => tpl`
        <button @click=${this.inc}>count is ${this.count}</button>
    `;
}
```

There is no `.value` and no refs — you read and mutate state directly.
