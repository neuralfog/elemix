WIP

- [] App Event Bus - CustomEvents suck!
- [] Error Boundary via bus
- [] Suspense :thinking:
- [] Helpers to get instances of components (refs work) ??
- [] Helper to get parent component easily
   - [] Helper to get closest Boundary
        - [] Not necessary DOM traversal ??
        - [] May be cheap to do it once on Mount!!
        - [] Set on child as ref!!
        - [] Nested Components ??
        - [] May be easier with event bus and tagging fe `<Suspense name="something" />`
            - [] Register handlers based on tags automagically
            - [] Don't want to do decorators, they are fucking horrible in js (I had enough of them LOL)
            - [] Explore decorators route - on the end the most ergonomic solution matters
            - [] Ha.. For O(1) lookups I can register boundaries as map on App instance fe: App.getErrorBoundry(tag) && App.getSuspense(tag)

```
    <Suspense>
    slot #fallback <Loader />
    slot #content <UserCard />
    </Suspense>

```

Extended Component Names:
- Suspense -> Suspendee
- ErrorBoundry -> ErrorEmiter

Extent from Component add properties to deal with suspension easily
Auto update parent instance!!

Similar will apply to <ErrorBoundry />
