# C# Code Style

## Naming

### Fields

Fields are never public. Data that crosses a type boundary is a property (`{ get; }`, `{ get; init; }`), not a field, so every field is private or internal.

Private and internal fields use PascalCase, the same casing as public members. The access modifier marks visibility, not the casing. This holds for `readonly`, `static readonly`, and `const` too.

Never prefix a field with an underscore. Never use camelCase for a private or internal field.

`this.` appears only to resolve a genuine collision between a field and a same-named local or parameter. Fields are PascalCase and locals are camelCase, so collisions are rare and `this.` is almost never present.

```csharp
public sealed class Player {
    private readonly string PlayerName;
    private int Score;

    public Player(string playerName) {
        PlayerName = playerName;
        Score = 0;
    }

    public void AddToScore(int points) {
        Score += points;
    }
}
```

Rejected: `_playerName`, `private int score;`.

### Types, members, locals

- Types (class, record, struct, enum, interface, delegate): PascalCase. Interfaces are `I`-prefixed.
- Public members (methods, properties, events): PascalCase.
- Method parameters and local variables: camelCase.

## Formatting

- K&R braces. The opening brace stays on the same line as the declaration or statement it belongs to. `else`, `catch`, and `finally` sit on the same line as the preceding closing brace.
- Four-space indentation, spaces not tabs.
- File-scoped namespaces: `namespace MyApp.Http;`.
- All `using` directives at the top of the file, system directives sorted first.
- `var` when the right-hand side makes the type obvious.
- Expression-bodied members for one-line methods and properties: `public string Status() => $"Score: {Score}";`.

Formatting is enforced, not just documented. `.editorconfig` at the repository root drives it, the project sets `EnforceCodeStyleInBuild` and raises `IDE0055` to an error, so a misplaced brace fails the build. `dotnet format` applies the style and `dotnet format --verify-no-changes` gates it in CI.

## Type and API design

- `sealed` by default on classes. Leave a class unsealed only when inheritance is the intended design.
- `internal` is the default visibility. `public` is a contract, committed to deliberately. Interfaces for extension points, sealed classes for implementations.
- Public data is a property, never a public field. A property keeps the door open to validation, `init`-only immutability, and interface implementation without breaking callers.
- Immutable by default: `readonly` fields, `init`-only or `required` properties, `record` for data, `readonly record struct` for small value types.
- No mutable static state. The rare exception is set-once startup configuration: a static assigned once at boot and never mutated afterward, called out where it lives.

## Nullability

- Nullable reference types are enabled. A legitimately nullable value is declared with the `?` suffix.
- Guard arguments with the throw helpers: `ArgumentNullException.ThrowIfNull(argument)`, `ArgumentException.ThrowIfNullOrEmpty(text)`, `ObjectDisposedException.ThrowIf(disposed, this)`.
- Null-check with `is null` / `is not null` or pattern matching.
- Avoid the null-forgiving operator `!` unless it is unavoidable and the surrounding code guarantees the value is non-null.

```csharp
public void SetShader(Shader? newShader) {
    ArgumentNullException.ThrowIfNull(newShader);
    SpriteShader = newShader;
}
```

## Defensive programming - fail early

Validate at the boundary and fail on the first broken assumption, close to the cause rather than three frames later. Two tools, two jobs.

- Input crossing a boundary is guarded with throw-helpers that always run. Anything entering a `public` or `internal` API is checked up front and throws a precise exception: `ArgumentNullException.ThrowIfNull(x)`, `ArgumentException.ThrowIfNullOrEmpty(text)`, `ArgumentOutOfRangeException.ThrowIfNegative(count)`, `ObjectDisposedException.ThrowIf(disposed, this)`. These ship in the library and hold in production.
- Internal invariants are asserted with `Debug.Assert`. For a state a correct program can never reach, assert it: `Debug.Assert(index >= 0)`. `Debug.Assert` is `[Conditional("DEBUG")]`, so the call and its arguments compile away entirely in a Release build. The check costs nothing in the shipped package and never reaches the AOT compiler, so assert internal assumptions liberally.
- Keep side effects out of `Debug.Assert`. The arguments are not evaluated once stripped, so the condition must be a pure read. `Debug.Assert(Advance())` stops advancing in Release.
- Assert internal invariants with `Debug.Assert`, not `Trace.Assert`. `Trace.Assert` is `[Conditional("TRACE")]`, and `TRACE` is defined in Release too, so it is never stripped.

## Async

- `ValueTask` / `ValueTask<T>` on hot paths that often complete synchronously. `Task` on the public edges.
- `CancellationToken` on every async API, threaded through.
- Never block on async: no `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`. No `async void` outside event handlers. Use `await using`, `await foreach`, and `IAsyncEnumerable<T>` for streams.
- No `ConfigureAwait(false)`. The server runtime has no `SynchronizationContext`, so it is noise.

## Performance and AOT

- AOT and trim safe. No reflection-based serialization, activation. No `dynamic`, no `Activator.CreateInstance` on open generics, no `Expression.Compile` or `Reflection.Emit`. Source generators only, including System.Text.Json source generation. Libraries are marked `IsAotCompatible`, and any unavoidable case is annotated with `[RequiresDynamicCode]` / `[DynamicallyAccessedMembers]`.
- Zero-allocation hot paths: `Span<T>` / `ReadOnlySpan<T>`, `stackalloc` for small buffers, `ArrayPool<T>` for reusable ones. Work in UTF-8 bytes on the wire, not `string`.
- `System.IO.Pipelines` for high-throughput IO.
- `FrozenDictionary` / `FrozenSet` for build-once-read-many lookups, `SearchValues<T>` for byte and character scanning, `CollectionsMarshal` for dictionary and list fast paths.
- No LINQ on hot paths. `static` lambdas and static local functions to avoid closure allocations. `ObjectPool<T>` for per-request objects.

## Modern syntax

Use the latest C# language features the target framework supports: collection expressions `[...]` and spreads, target-typed `new()`, primary constructors, `required` / `init`, list / property / relational patterns, `switch` expressions over statements, raw string literals, and the `field` keyword.

## Comments

Explanatory comments are removed. No `//`, no `/* */`, no XML documentation `///`. This extends to configuration files: no comments in `.editorconfig`, `.csproj`, or the `Makefile` either. The code carries its own meaning.

The one exception is a deliberate author annotation: a comment the author tags with an `@`-marker as a signal. These are preserved.

```csharp
// @Note keeping this branch until the legacy path is retired
```

`@Note`, `@Todo`, `@Question`, and the like stay. Every untagged comment goes.

An empty `catch` block still needs a real statement, since no comment can fill it: `catch { return; }`.
