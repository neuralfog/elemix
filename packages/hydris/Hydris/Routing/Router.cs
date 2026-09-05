using System.Diagnostics;
using Hydris.Container;
using Hydris.Http;

namespace Hydris.Routing;

public sealed class Router {
    private readonly List<Route> Routes = [];
    private readonly RouteTree Tree = new();

    public int Count => Routes.Count;

    public void Map(Method method, string path, Func<Reply> handler) {
        Debug.Assert(handler is not null);
        Add(method, path, [], false, _ => Task.FromResult(handler()));
    }

    public void Map<T>(Method method, string path, Func<T, Reply> action) {
        Debug.Assert(action is not null);
        Add(method, path, [], false, scope => Task.FromResult(action(scope.Get<T>())));
    }

    public void Map<T>(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<T, Reply> action) {
        Debug.Assert(middlewares is not null);
        Debug.Assert(action is not null);
        Add(method, path, middlewares, json, scope => Task.FromResult(action(scope.Get<T>())));
    }

    public void Map<T>(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<T, Task<Reply>> action) {
        Debug.Assert(middlewares is not null);
        Debug.Assert(action is not null);
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
        Debug.Assert(path is not null);

        var span = PathSpan(path);
        Span<Range> buffer = stackalloc Range[MaxSegments];
        var segments = Split(span, buffer);

        var route = Tree.Find(method, span, segments);
        if (route is null)
            return null;

        var parameters = route.Match(span, segments);
        Debug.Assert(parameters is not null);
        return new RouteMatch(route, parameters!);
    }

    public IReadOnlyList<Method> AllowedMethods(string path) {
        Debug.Assert(path is not null);

        var span = PathSpan(path);
        Span<Range> buffer = stackalloc Range[MaxSegments];
        var segments = Split(span, buffer);

        var methods = new List<Method>();
        foreach (var route in Routes) {
            if (route.Match(span, segments) is not null && !methods.Contains(route.Method))
                methods.Add(route.Method);
        }

        return methods;
    }

    private const int MaxSegments = 32;

    private static ReadOnlySpan<char> PathSpan(string path) {
        var query = path.IndexOf('?');
        return query >= 0 ? path.AsSpan(0, query) : path.AsSpan();
    }

    private static ReadOnlySpan<Range> Split(ReadOnlySpan<char> path, Span<Range> buffer) {
        var count = Tokenize(path, buffer);
        if (count >= 0)
            return buffer[..count];

        var heap = new Range[CountSegments(path)];
        Tokenize(path, heap);
        return heap;
    }

    private static int Tokenize(ReadOnlySpan<char> path, Span<Range> segments) {
        var count = 0;
        var start = 0;
        for (var i = 0; i <= path.Length; i++) {
            if (i < path.Length && path[i] != '/')
                continue;
            if (i > start) {
                if (count == segments.Length)
                    return -1;
                segments[count++] = new Range(start, i);
            }

            start = i + 1;
        }

        return count;
    }

    private static int CountSegments(ReadOnlySpan<char> path) {
        var count = 0;
        var start = 0;
        for (var i = 0; i <= path.Length; i++) {
            if (i < path.Length && path[i] != '/')
                continue;
            if (i > start)
                count++;
            start = i + 1;
        }

        return count;
    }

    private void Add(Method method, string path, IReadOnlyList<Type> middlewares, bool json, Func<DiContainer, Task<Reply>> handler) {
        Debug.Assert(path is not null);
        var route = new Route(method, path, handler, middlewares, json);
        Routes.Add(route);
        Tree.Insert(route);
    }
}
