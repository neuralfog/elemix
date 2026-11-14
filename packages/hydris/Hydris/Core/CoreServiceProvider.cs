using System.IO;
using Hydris.Container;
using Hydris.Http;
using Hydris.Logging;

namespace Hydris.Core;

public sealed class CoreServiceProvider : ServiceProvider {
    private const string HttpScopeHint = "these tokens are only available inside an HTTP request scope";

    public override void Register(DiContainer container) {
        container.ContextTokens("http", [typeof(Request)], HttpScopeHint);
        container.Singleton(_ => ElemixManifest.Load(
            Path.Combine(AppContext.BaseDirectory, "public", "_elemix", "manifest.json")));
        container.Scoped(c => new CookieAuthority(c.Get<Request>()));
        container.Scoped<ICsrf>(c => new Csrf(c.Get<Request>(), c.Get<CookieAuthority>()));
        container.Singleton(_ => new CspConfig());
        container.Singleton(c => new CspPolicy(c.Get<CspConfig>()));
        container.Singleton(_ => new SecurityHeadersConfig());
        container.Singleton(c => new SecurityHeaders(c.Get<SecurityHeadersConfig>()));
        container.Singleton(_ => new Logger(new ConsoleLoggerDriver()));
    }

    public static DiContainer RequestScope(DiContainer container, Request request) {
        var scope = container.Scope();
        scope.Value(scope);
        scope.Value(request);
        return scope;
    }
}
