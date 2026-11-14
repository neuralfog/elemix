using Hydris;
using Hydris.Http;

namespace Hydris.Tests;

[CollectionDefinition("SecurityHeaders", DisableParallelization = true)]
public sealed class SecurityHeadersCollection;

[Collection("SecurityHeaders")]
public sealed class SecurityHeadersTests : IDisposable {
    private static readonly string[] Keys = [
        "SECURITY_HSTS", "SECURITY_CONTENT_TYPE_OPTIONS", "SECURITY_REFERRER_POLICY",
        "SECURITY_FRAME_OPTIONS", "SECURITY_PERMISSIONS_POLICY",
        "SECURITY_CROSS_ORIGIN_OPENER_POLICY", "SECURITY_CROSS_ORIGIN_EMBEDDER_POLICY",
        "SECURITY_CROSS_ORIGIN_RESOURCE_POLICY",
    ];

    private static void ClearAll() {
        foreach (var key in Keys)
            Environment.SetEnvironmentVariable(key, null);
    }

    private static void SetVar(string key, string value) =>
        Environment.SetEnvironmentVariable(key, value);

    public SecurityHeadersTests() => ClearAll();

    public void Dispose() {
        ClearAll();
        SecurityHeaderGate.Reset();
    }

    [Fact]
    public void EmptyWhenNothingSet() {
        var headers = new SecurityHeaders(new SecurityHeadersConfig());
        Assert.True(headers.IsEmpty);
        Assert.False(headers.Has("X-Content-Type-Options"));
        Assert.Null(headers.Get("X-Content-Type-Options"));
    }

    [Theory]
    [InlineData("SECURITY_HSTS", "Strict-Transport-Security", "max-age=63072000")]
    [InlineData("SECURITY_CONTENT_TYPE_OPTIONS", "X-Content-Type-Options", "nosniff")]
    [InlineData("SECURITY_REFERRER_POLICY", "Referrer-Policy", "no-referrer")]
    [InlineData("SECURITY_FRAME_OPTIONS", "X-Frame-Options", "DENY")]
    [InlineData("SECURITY_PERMISSIONS_POLICY", "Permissions-Policy", "geolocation=()")]
    [InlineData("SECURITY_CROSS_ORIGIN_OPENER_POLICY", "Cross-Origin-Opener-Policy", "same-origin")]
    [InlineData("SECURITY_CROSS_ORIGIN_EMBEDDER_POLICY", "Cross-Origin-Embedder-Policy", "require-corp")]
    [InlineData("SECURITY_CROSS_ORIGIN_RESOURCE_POLICY", "Cross-Origin-Resource-Policy", "same-origin")]
    public void EachEnvKeyMapsToExactHeader(string key, string header, string value) {
        SetVar(key, value);
        var headers = new SecurityHeaders(new SecurityHeadersConfig());
        Assert.True(headers.Has(header));
        Assert.Equal(value, headers.Get(header));

        var reply = Reply.Text("ok");
        SecurityHeaderGate.Configure(headers);
        SecurityHeaderGate.Apply(reply);
        Assert.Equal(value, reply.HeaderValue(header));
    }

    [Fact]
    public void HeadersFollowCatalogOrder() {
        SetVar("SECURITY_REFERRER_POLICY", "no-referrer");
        SetVar("SECURITY_HSTS", "max-age=1");
        SetVar("SECURITY_CONTENT_TYPE_OPTIONS", "nosniff");
        var headers = new SecurityHeaders(new SecurityHeadersConfig());
        Assert.Equal(
            new[] { "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy" },
            headers.All.Select(h => h.Key));
    }

    [Fact]
    public void ApplyDoesNotOverrideExistingHeader() {
        SetVar("SECURITY_REFERRER_POLICY", "no-referrer");
        SecurityHeaderGate.Configure(new SecurityHeaders(new SecurityHeadersConfig()));
        var reply = Reply.Text("ok").Header("Referrer-Policy", "unsafe-url");
        SecurityHeaderGate.Apply(reply);
        Assert.Equal("unsafe-url", reply.HeaderValue("Referrer-Policy"));
    }

    [Fact]
    public void EmptyAppliesNothing() {
        SecurityHeaderGate.Configure(new SecurityHeaders(new SecurityHeadersConfig()));
        var reply = Reply.Text("ok");
        SecurityHeaderGate.Apply(reply);
        Assert.Null(reply.HeaderValue("X-Content-Type-Options"));
    }

    [Fact]
    public void ResetDisablesAndClears() {
        SetVar("SECURITY_CONTENT_TYPE_OPTIONS", "nosniff");
        SecurityHeaderGate.Configure(new SecurityHeaders(new SecurityHeadersConfig()));
        SecurityHeaderGate.Enable();
        Assert.True(SecurityHeaderGate.Enabled);

        SecurityHeaderGate.Reset();

        Assert.False(SecurityHeaderGate.Enabled);
        var reply = Reply.Text("ok");
        SecurityHeaderGate.Apply(reply);
        Assert.Null(reply.HeaderValue("X-Content-Type-Options"));
    }

    [Fact]
    public void EnableLoadsEnvFileAndRegistersServiceInDi() {
        var path = Path.Combine(Path.GetTempPath(), "sec-" + Guid.NewGuid().ToString("N") + ".env");
        File.WriteAllText(path, "SECURITY_HSTS=\"max-age=63072000; includeSubDomains\"\nSECURITY_CONTENT_TYPE_OPTIONS=nosniff\n");
        try {
            var app = new App();
            app.EnableSecurityHeaders(new SecurityHeadersOptions { EnvFile = path });

            Assert.True(SecurityHeaderGate.Enabled);
            var service = app.Container.Get<SecurityHeaders>();
            Assert.Equal("max-age=63072000; includeSubDomains", service.Get("Strict-Transport-Security"));
            Assert.Equal("nosniff", service.Get("X-Content-Type-Options"));

            var reply = Reply.Text("ok");
            SecurityHeaderGate.Apply(reply);
            Assert.Equal("nosniff", reply.HeaderValue("X-Content-Type-Options"));
        } finally {
            File.Delete(path);
            Environment.SetEnvironmentVariable("SECURITY_HSTS", null);
            Environment.SetEnvironmentVariable("SECURITY_CONTENT_TYPE_OPTIONS", null);
        }
    }

    [Fact]
    public void ConfigIsASingletonInjectedIntoService() {
        SetVar("SECURITY_CONTENT_TYPE_OPTIONS", "nosniff");
        var app = new App();

        var config = app.Container.Get<SecurityHeadersConfig>();
        var service = app.Container.Get<SecurityHeaders>();

        Assert.Same(config, app.Container.Get<SecurityHeadersConfig>());
        Assert.Same(service, app.Container.Get<SecurityHeaders>());
        Assert.True(service.Has("X-Content-Type-Options"));
    }
}
