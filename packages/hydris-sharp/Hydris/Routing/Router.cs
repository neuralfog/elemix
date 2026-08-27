using Hydris.Container;
using Hydris.Http;

namespace Hydris.Routing;

public sealed class Router {
    private readonly List<Route> Routes = [];
    private readonly RouteTree Tree = new();

    public int Count => Routes.Count;

    public void Map(Method method, string path, Func<Reply> handler) {
        ArgumentNullException.ThrowIfNull(handler);
        Add(method, path, [], false, _ => Task.FromResult(handler()));
    }

    public void Map<T>(Method method, string path, Func<T, Reply> action) {
        ArgumentNullException.ThrowIfNull(action);
        Add(method, path, [], false, scope => Task.FromResult(action(scope.Get<T>())));
    }

    public void Map<T>(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<T, Reply> action) {
        ArgumentNullException.ThrowIfNull(middlewares);
        ArgumentNullException.ThrowIfNull(action);
        Add(method, path, middlewares, json, scope => Task.FromResult(action(scope.Get<T>())));
    }

    public void Map<T>(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<T, Task<Reply>> action) {
        ArgumentNullException.ThrowIfNull(middlewares);
        ArgumentNullException.ThrowIfNull(action);
        Add(method, path, middlewares, json, scope => action(scope.Get<T>()));
    }

    public void Get(string path, Func<Reply> handler) => Map(Method.Get, path, handler);
    public void Get<T>(string path, Func<T, Reply> action) => Map(Method.Get, path, action);
    public void Head(string path, Func<Reply> handler) => Map(Method.Head, path, handler);
    public void Head<T>(string path, Func<T, Reply> action) => Map(Method.Head, path, action);
    public void Post(string path, Func<Reply> handler) => Map(Method.Post, path, handler);
    public void Post<T>(string path, Func<T, Reply> action) => Map(Method.Post, path, action);
    public void Put(string path, Func<Reply> handler) => Map(Method.Put, path, handler);
    public void Put<T>(string path, Func<T, Reply> action) => Map(Method.Put, path, action);
    public void Patch(string path, Func<Reply> handler) => Map(Method.Patch, path, handler);
    public void Patch<T>(string path, Func<T, Reply> action) => Map(Method.Patch, path, action);
    public void Delete(string path, Func<Reply> handler) => Map(Method.Delete, path, handler);
    public void Delete<T>(string path, Func<T, Reply> action) => Map(Method.Delete, path, action);
    public void Connect(string path, Func<Reply> handler) => Map(Method.Connect, path, handler);
    public void Connect<T>(string path, Func<T, Reply> action) => Map(Method.Connect, path, action);
    public void Options(string path, Func<Reply> handler) => Map(Method.Options, path, handler);
    public void Options<T>(string path, Func<T, Reply> action) => Map(Method.Options, path, action);
    public void Trace(string path, Func<Reply> handler) => Map(Method.Trace, path, handler);
    public void Trace<T>(string path, Func<T, Reply> action) => Map(Method.Trace, path, action);

    public RouteMatch? Match(Method method, string path) {
        ArgumentNullException.ThrowIfNull(path);

        var parts = Route.SegmentsOf(path);
        var route = Tree.Find(method, parts);
        return route is null ? null : new RouteMatch(route, route.Match(parts)!);
    }

    public IReadOnlyList<Method> AllowedMethods(string path) {
        ArgumentNullException.ThrowIfNull(path);

        var parts = Route.SegmentsOf(path);
        var methods = new List<Method>();

        foreach (var route in Routes) {
            if (route.Match(parts) is not null && !methods.Contains(route.Method))
                methods.Add(route.Method);
        }

        return methods;
    }

    private void Add(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<DiContainer, Task<Reply>> handler) {
        ArgumentNullException.ThrowIfNull(path);
        var route = new Route(method, path, handler, middlewares, json);
        Routes.Add(route);
        Tree.Insert(route);
    }
}
