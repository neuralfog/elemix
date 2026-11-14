using System.Net;
using Hydris;
using Hydris.Container;
using Hydris.Core;
using Hydris.Error;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Hydris.Tests;

public sealed class DispatcherErrorTests {
    private static (IFeatureCollection Features, HttpResponseFeature Response, MemoryStream Body) Features(string method, string target) {
        var features = new FeatureCollection();
        features.Set<IHttpRequestFeature>(new HttpRequestFeature {
            Method = method,
            RawTarget = target,
            Path = target,
            Scheme = "http",
            QueryString = string.Empty,
            Body = Stream.Null,
            Headers = new HeaderDictionary(),
        });
        var response = new HttpResponseFeature();
        features.Set<IHttpResponseFeature>(response);
        var body = new MemoryStream();
        features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(body));
        features.Set<IHttpConnectionFeature>(new HttpConnectionFeature { RemoteIpAddress = IPAddress.Loopback });
        features.Set<IHttpRequestLifetimeFeature>(new HttpRequestLifetimeFeature());
        return (features, response, body);
    }

    [Fact]
    public async Task RenderThrowDuringMaterializeBecomesErrorReplyNotRaw500() {
        var container = new DiContainer();
        new CoreServiceProvider().Register(container);
        var router = new Router();
        router.Get<Request>("/l8-boom", _ => Reply.View("__l8_missing_view__"));

        var dispatcher = new Dispatcher(router, container, false, [], new DefaultErrorRenderer(), 1_000_000);
        var (features, response, body) = Features("GET", "/l8-boom");

        await dispatcher.ProcessRequestAsync(dispatcher.CreateContext(features));

        Assert.Equal(500, response.StatusCode);
        Assert.True(body.Length > 0);
    }
}
