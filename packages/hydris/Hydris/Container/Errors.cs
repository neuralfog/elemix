namespace Hydris.Container;

public sealed class UnboundTokenException(string description)
    : Exception($"No binding registered for {description}");

public sealed class ScopeRequiredException(string description)
    : Exception($"{description} is scoped and requires an active request scope");

public sealed class CircularDependencyException(IReadOnlyList<string> chain)
    : Exception($"Circular dependency detected: {string.Join(" -> ", chain)}") {
    public IReadOnlyList<string> Chain { get; } = chain;
}

public sealed class ForbiddenDependencyException(string context, IReadOnlyList<string> chain, string? hint)
    : Exception(Compose(context, chain, hint)) {
    public string Context { get; } = context;
    public IReadOnlyList<string> Chain { get; } = chain;

    private static string Compose(string context, IReadOnlyList<string> chain, string? hint) {
        var message = $"Cannot resolve {string.Join(" -> ", chain)}: this scope has no '{context}' context";
        return hint is null ? message : $"{message} ({hint})";
    }
}
