using System.IO;
using Hydris.Container;
using Hydris.Http;

namespace Hydris.Core;

public sealed class CoreServiceProvider : ServiceProvider {
    private const string HttpScopeHint = "these tokens are only available inside an HTTP request scope";

    public override void Register(DiContainer container) {
        container.ContextTokens("http", [typeof(Request)], HttpScopeHint);
        container.Singleton(_ => ElemixManifest.Load(
            Path.Combine(AppContext.BaseDirectory, "public", "_elemix", "manifest.json")));
        container.Scoped(c => new CookieAuthority(c.Get<Request>()));
    }

    public static DiContainer RequestScope(DiContainer container, Request request) {
        var scope = container.Scope();
        scope.Value(scope);
        scope.Value(request);
        return scope;
    }
}
