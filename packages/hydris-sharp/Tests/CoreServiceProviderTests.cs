using Hydris.Container;
using Hydris.Core;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class CoreServiceProviderTests {
    private static DiContainer Core() {
        var container = new DiContainer();
        new CoreServiceProvider().Register(container);
        return container.Start();
    }

    [Fact]
    public void JobScopeRejectsRequestScopedTokens() {
        var job = Core().Scope().NoHttp();

        Assert.Throws<ForbiddenDependencyException>(() => job.Get<Request>());
    }

    [Fact]
    public void RequestScopeStillResolvesRequest() {
        var container = Core();
        var request = new Request(Method.Get, "/", new Dictionary<string, string>(), new HeaderDictionary());
        var scope = CoreServiceProvider.RequestScope(container, request);

        Assert.Same(request, scope.Get<Request>());
    }
}
