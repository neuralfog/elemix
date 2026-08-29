using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class ProxyResolverTests {
    private static Request Req(HeaderDictionary headers) =>
        new(Method.Get, "/", new Dictionary<string, string>(), headers);

    [Fact]
    public void ResolveIpReturnsSocketIpWhenNotTrustingProxy() {
        var request = Req(new HeaderDictionary { ["X-Forwarded-For"] = "1.1.1.1" });

        Assert.Equal("9.9.9.9", ProxyResolver.ResolveIp(request, "9.9.9.9", trustProxy: false));
    }

    [Fact]
    public void ResolveIpTakesFirstForwardedForWhenTrustingProxy() {
        var request = Req(new HeaderDictionary { ["X-Forwarded-For"] = "1.1.1.1, 2.2.2.2" });

        Assert.Equal("1.1.1.1", ProxyResolver.ResolveIp(request, "9.9.9.9", trustProxy: true));
    }

    [Fact]
    public void ResolveIpPrefersCfConnectingIpOverForwardedFor() {
        var request = Req(new HeaderDictionary {
            ["CF-Connecting-IP"] = "3.3.3.3",
            ["X-Forwarded-For"] = "1.1.1.1",
        });

        Assert.Equal("3.3.3.3", ProxyResolver.ResolveIp(request, "9.9.9.9", trustProxy: true));
    }

    [Fact]
    public void ResolveIpFallsBackToSocketIpWhenNoForwardedHeaders() {
        var request = Req([]);

        Assert.Equal("9.9.9.9", ProxyResolver.ResolveIp(request, "9.9.9.9", trustProxy: true));
    }

    [Fact]
    public void ResolveProtocolUsesSchemeWhenNotTrustingProxy() {
        var request = Req(new HeaderDictionary { ["X-Forwarded-Proto"] = "https" });

        Assert.Equal("http", ProxyResolver.ResolveProtocol(request, "http", trustProxy: false));
    }

    [Fact]
    public void ResolveProtocolUsesForwardedProtoWhenTrustingProxy() {
        var request = Req(new HeaderDictionary { ["X-Forwarded-Proto"] = "https" });

        Assert.Equal("https", ProxyResolver.ResolveProtocol(request, "http", trustProxy: true));
    }
}
