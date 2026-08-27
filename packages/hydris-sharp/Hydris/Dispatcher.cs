using Hydris.Container;
using Hydris.Core;
using Hydris.Error;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Http.Features;

namespace Hydris;

internal sealed class Dispatcher(
    Router router,
    DiContainer services,
    bool trustProxy,
    IReadOnlyList<Type> middlewares,
    IErrorRenderer errors)
    : IHttpApplication<Dispatcher.Context> {
    public sealed class Context(IFeatureCollection features) {
        public IHttpRequestFeature Request { get; } = features.GetRequiredFeature<IHttpRequestFeature>();
        public IHttpResponseFeature Response { get; } = features.GetRequiredFeature<IHttpResponseFeature>();
        public IHttpResponseBodyFeature Body { get; } = features.GetRequiredFeature<IHttpResponseBodyFeature>();
        public IHttpConnectionFeature Connection { get; } = features.GetRequiredFeature<IHttpConnectionFeature>();
    }

    public Context CreateContext(IFeatureCollection features) => new(features);

    public async Task ProcessRequestAsync(Context context) {
        var target = context.Request.RawTarget;
        var parsed = TryParseMethod(context.Request.Method, out var method);
        var match = parsed ? router.Match(method, target) : null;

        var request = new Request(method, match?.Path ?? PathOf(target), match?.Params ?? Empty, context.Request.Headers);
        request.Ip = ProxyResolver.ResolveIp(request, context.Connection.RemoteIpAddress?.ToString() ?? string.Empty, trustProxy);
        request.Protocol = ProxyResolver.ResolveProtocol(request, context.Request.Scheme, trustProxy);

        await using var scope = CoreServiceProvider.RequestScope(services, request);
        Reply reply;
        try {
            if (match is null) {
                var allowed = router.AllowedMethods(target);
                throw allowed.Count > 0
                    ? new MethodNotAllowedException(AllowTokens(allowed))
                    : new NotFoundException();
            }

            var chain = Chain(middlewares, match.Middlewares);
            reply = await Pipeline.Run(scope, chain, () => match.Handler(scope));
        } catch (Exception error) {
            reply = Fail(error, request, match?.Json ?? false);
        }

        await reply.WriteTo(context.Response, context.Body);
    }

    public void DisposeContext(Context context, Exception? exception) { }

    private Reply Fail(Exception error, Request request, bool json) {
        if (DefaultErrorRenderer.StatusOf(error) >= 500)
            Console.Error.WriteLine(error);

        Reply reply;
        try {
            reply = errors.Render(error, request, json);
        } catch {
            reply = Reply.Text("Internal Server Error").Status(500);
        }

        if (error is MethodNotAllowedException allowed && allowed.Allowed.Count > 0)
            reply.Header("Allow", string.Join(", ", allowed.Allowed));

        return reply;
    }

    private static readonly Dictionary<string, string> Empty = [];

    private static string PathOf(string target) {
        var query = target.IndexOf('?', StringComparison.Ordinal);
        return query < 0 ? target : target[..query];
    }

    private static string[] AllowTokens(IReadOnlyList<Method> allowed) {
        var tokens = new string[allowed.Count];
        for (var i = 0; i < allowed.Count; i++)
            tokens[i] = allowed[i].ToString().ToUpperInvariant();
        return tokens;
    }

    private static IReadOnlyList<Type> Chain(IReadOnlyList<Type> global, IReadOnlyList<Type> route) {
        if (route.Count == 0)
            return global;
        if (global.Count == 0)
            return route;

        var combined = new Type[global.Count + route.Count];
        for (var i = 0; i < global.Count; i++)
            combined[i] = global[i];
        for (var i = 0; i < route.Count; i++)
            combined[global.Count + i] = route[i];
        return combined;
    }

    private static bool TryParseMethod(string method, out Method result) {
        result = method switch {
            "GET" => Method.Get,
            "HEAD" => Method.Head,
            "POST" => Method.Post,
            "PUT" => Method.Put,
            "PATCH" => Method.Patch,
            "DELETE" => Method.Delete,
            "CONNECT" => Method.Connect,
            "OPTIONS" => Method.Options,
            "TRACE" => Method.Trace,
            _ => (Method)(-1),
        };
        return (int)result >= 0;
    }
}
