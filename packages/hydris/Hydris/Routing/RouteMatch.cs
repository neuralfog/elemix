using Hydris.Container;
using Hydris.Http;

namespace Hydris.Routing;

public sealed class RouteMatch {
    public Method Method { get; }
    public string Path { get; }
    public IReadOnlyDictionary<string, string> Params { get; }
    public bool Json { get; }

    internal Func<DiContainer, Task<Reply>> Handler { get; }
    internal IReadOnlyList<Type> Middlewares { get; }

    internal RouteMatch(Route route, IReadOnlyDictionary<string, string> parameters) {
        Method = route.Method;
        Path = route.Path;
        Params = parameters;
        Json = route.Json;
        Handler = route.Handler;
        Middlewares = route.Middlewares;
    }

    public string? Param(string name) => Params.TryGetValue(name, out var value) ? value : null;
}
