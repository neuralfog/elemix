## Reactive Element

-   [x] Template Rendering - uhtml - https://github.com/WebReflection/uhtml
    -   [x] Granular control of rendering cycle
        -   [x] render()
        -   [x] Component lifecycle methods (onRender, onMount etc)
-   [x] Internal Reactive State - Proxy, Pub Sub
-   [x] External State - As seen in Preact Signals
-   [x] Main Class Decorator 🎨 - ability to subscribe to global signals
-   [x] Local Sate Decorator 🎨
-   [x] Implementation for Reactive Props
-   [x] Ref handling
-   [x] View Model Binding ❤️ - I need it in my Live!! Like now! Vue: https://vuejs.org/guide/components/v-model.html
-   [x] App Config
-   [x] Single Entry Point
-   [x] UHTML `@` 👀 - inline handlers
-   [x] Refactor PubSub
-   [x] Batch rendering for the component `render()` methods!
    -   `uhtml` dom diffing is very cheap, 0.1 millisecond
    -   `setTimeout` - FTW!!
-   [x] Allow passing custom user defined `renderTriggers`
    -   [x] Local State
    -   [x] Signals
-   [x] Prop Diffing
    -   Props are getting always set when parent rerenders, triggering child component to schedule a render
        -   Shallow Diffing:
            -   [x] Primitives - EZ 🎉
            -   [x] `null` you suck so much!
            -   [x] Objects - objects let it render!
            -   [x] Function, callback, handler - set it once and forget!
-   [x] Split `Component` in to responsibilities:
    -   [x] Renderer
    -   [x] Local State
    -   [x] Props
-   [x] Styling - https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet
    -   No css in jss, CSS or SCSS
-   [x] Make it supper hot - pre benchmarking 🔥🔥🔥🔥🔥🔥🔥 - It does not brake a sweat 😓 🎉
-   [x] Props Cache causing performance issues, kicking in Long Running Tasks periodically - cache removed ✅
-   [x] Proxy Nesting!! Probably Fixed 👀
-   [x] Make sure there is no issues with a cleanup, something maybe kicking of when shrinking the list of components (perf repo) - User Error ✅

## Testing

-   [x] Testing Framework - Vitest
-   [x] Shadow DOM Piercing
-   [x] Concept of screen
-   [x] DOM HTML Snapshots
-   [x] Setup Testing framework inside of the package
-   [x] Test the framework
    -   [x] App Context
    -   [x] Internal State Updates
    -   [x] Signal Updates
    -   [x] Props Updates
        -   [x] Props Diffing
            -   [x] Primitives
            -   [x] Handlers
            -   [x] Objects
    -   [x] Signal Cleanups
    -   [x] Lifecycle Methods
        -   [x] onMount
        -   [x] onDispose
        -   [x] onRender
            -   [x] Render Batching
            -   [x] User defined flags
    -   [x] Styles
    -   [x] Magic rendering when throwing reactive proxies around via props
    -   [x] Ref
    -   [x] View Model Binding
    -   [x] Reactive
        -   [x] Arrays
        -   [x] Unsupported Collections
        -   [x] Nested Objects
-   [x] Setup Github Actions - Run tests on every push

## Discovery

-   [] WC-Micro why do I need a tag in decorator config, why not to derive this from class name ?

## Nice To Have

-   [] Centralized Error Handler
-   [] Improve View Model Binding - (~value:input)
-   [] Can I have collections in my reactive state
-   [] Can I have async in onMount, can onMount itself be async
-   [] Prop Validation ??
-   [] Can I detect dangling custom elements tags ?? missing imports ??
-   [] Prop rendering array dependency ??
-   [] Releasing based on tags

## SSR

-   https://developer.chrome.com/docs/css-ui/declarative-shadow-dom
-   https://github.com/nksaraf/vinxi
-   https://nitro.unjs.io/
