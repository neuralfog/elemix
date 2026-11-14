using Hydris;
using Hydris.Http;

namespace Hydris.Tests;

[CollectionDefinition("Csp", DisableParallelization = true)]
public sealed class CspCollection;

[Collection("Csp")]
public sealed class CspTests : IDisposable {
    private static readonly string[] DirectiveKeys = [
        "CSP_DEFAULT_SRC", "CSP_SCRIPT_SRC", "CSP_SCRIPT_SRC_ELEM", "CSP_SCRIPT_SRC_ATTR",
        "CSP_STYLE_SRC", "CSP_STYLE_SRC_ELEM", "CSP_STYLE_SRC_ATTR", "CSP_IMG_SRC",
        "CSP_FONT_SRC", "CSP_CONNECT_SRC", "CSP_MEDIA_SRC", "CSP_OBJECT_SRC",
        "CSP_CHILD_SRC", "CSP_FRAME_SRC", "CSP_WORKER_SRC", "CSP_MANIFEST_SRC",
        "CSP_PREFETCH_SRC", "CSP_BASE_URI", "CSP_FORM_ACTION", "CSP_FRAME_ANCESTORS",
        "CSP_SANDBOX", "CSP_REPORT_URI", "CSP_REPORT_TO", "CSP_REQUIRE_TRUSTED_TYPES_FOR",
        "CSP_TRUSTED_TYPES", "CSP_UPGRADE_INSECURE_REQUESTS", "CSP_BLOCK_ALL_MIXED_CONTENT",
    ];

    private static bool IsBoolean(string key) =>
        key is "CSP_UPGRADE_INSECURE_REQUESTS" or "CSP_BLOCK_ALL_MIXED_CONTENT";

    private static void ClearAll() {
        Environment.SetEnvironmentVariable("CSP_REPORT_ONLY", null);
        foreach (var key in DirectiveKeys)
            Environment.SetEnvironmentVariable(key, null);
    }

    private static void SetVar(string key, string value) =>
        Environment.SetEnvironmentVariable(key, value);

    public CspTests() => ClearAll();

    public void Dispose() {
        ClearAll();
        Csp.Reset();
    }

    [Fact]
    public void EmptyWhenNothingSet() {
        var policy = new CspPolicy(new CspConfig());
        Assert.True(policy.IsEmpty);
        Assert.Equal("", policy.ToHeader());
    }

    [Fact]
    public void RendersDirectivesInCanonicalOrder() {
        SetVar("CSP_SCRIPT_SRC", "'self' https://cdn.example.com");
        SetVar("CSP_DEFAULT_SRC", "'self'");
        var policy = new CspPolicy(new CspConfig());
        Assert.Equal("default-src 'self'; script-src 'self' https://cdn.example.com", policy.ToHeader());
    }

    [Fact]
    public void GetAndHasReflectDirectives() {
        SetVar("CSP_IMG_SRC", "'self' data:");
        var policy = new CspPolicy(new CspConfig());
        Assert.True(policy.Has("img-src"));
        Assert.Equal("'self' data:", policy.Get("img-src"));
        Assert.False(policy.Has("script-src"));
        Assert.Null(policy.Get("script-src"));
    }

    [Fact]
    public void BooleanDirectiveRendersBareWhenTrue() {
        SetVar("CSP_UPGRADE_INSECURE_REQUESTS", "true");
        var policy = new CspPolicy(new CspConfig());
        Assert.Equal("upgrade-insecure-requests", policy.ToHeader());
        Assert.True(policy.Has("upgrade-insecure-requests"));
        Assert.Equal("", policy.Get("upgrade-insecure-requests"));
    }

    [Fact]
    public void BooleanDirectiveOmittedWhenFalse() {
        SetVar("CSP_UPGRADE_INSECURE_REQUESTS", "false");
        Assert.True(new CspPolicy(new CspConfig()).IsEmpty);
    }

    [Fact]
    public void InvalidBooleanDirectiveThrows() {
        SetVar("CSP_UPGRADE_INSECURE_REQUESTS", "maybe");
        Assert.Throws<EnvException>(() => new CspPolicy(new CspConfig()));
    }

    [Fact]
    public void EmptyValueDirectiveIsOmitted() {
        SetVar("CSP_DEFAULT_SRC", "");
        Assert.True(new CspPolicy(new CspConfig()).IsEmpty);
    }

    [Fact]
    public void EveryDirectiveIsMapped() {
        foreach (var key in DirectiveKeys)
            SetVar(key, IsBoolean(key) ? "true" : "'self'");

        var header = new CspPolicy(new CspConfig()).ToHeader();
        var parts = header.Split("; ");

        Assert.Equal(DirectiveKeys.Length, parts.Length);
        Assert.StartsWith("default-src 'self'", header);
        Assert.Contains("script-src-elem 'self'", header);
        Assert.Contains("frame-ancestors 'self'", header);
        Assert.Contains("require-trusted-types-for 'self'", header);
        Assert.Contains("upgrade-insecure-requests", parts);
        Assert.Contains("block-all-mixed-content", parts);
    }

    [Fact]
    public void ApplySetsEnforceHeader() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: false);
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Equal("default-src 'self'", reply.HeaderValue("Content-Security-Policy"));
        Assert.Null(reply.HeaderValue("Content-Security-Policy-Report-Only"));
    }

    [Fact]
    public void ReportOnlyUsesReportOnlyHeader() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: true);
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Equal("default-src 'self'", reply.HeaderValue("Content-Security-Policy-Report-Only"));
        Assert.Null(reply.HeaderValue("Content-Security-Policy"));
    }

    [Fact]
    public void ApplyDoesNotOverrideExistingHeader() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: false);
        var reply = Reply.Text("ok").Header("Content-Security-Policy", "default-src 'none'");
        Csp.Apply(reply);
        Assert.Equal("default-src 'none'", reply.HeaderValue("Content-Security-Policy"));
    }

    [Fact]
    public void EmptyPolicyAppliesNoHeader() {
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: false);
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Null(reply.HeaderValue("Content-Security-Policy"));
    }

    [Fact]
    public void EnableCspLoadsEnvFileAndRegistersPolicyInDi() {
        var path = Path.Combine(Path.GetTempPath(), "csp-" + Guid.NewGuid().ToString("N") + ".env");
        File.WriteAllText(path, "CSP_DEFAULT_SRC=\"'self'\"\nCSP_SCRIPT_SRC=\"'self' https://cdn.example.com\"\n");
        try {
            var app = new App();
            app.EnableCsp(new CspOptions { EnvFile = path });

            Assert.True(Csp.Enabled);
            var policy = app.Container.Get<CspPolicy>();
            Assert.True(policy.Has("default-src"));
            Assert.Equal("default-src 'self'; script-src 'self' https://cdn.example.com", policy.ToHeader());

            var reply = Reply.Text("ok");
            Csp.Apply(reply);
            Assert.Equal("default-src 'self'; script-src 'self' https://cdn.example.com",
                reply.HeaderValue("Content-Security-Policy"));
        } finally {
            File.Delete(path);
        }
    }

    [Fact]
    public void ReportOnlyDrivenByEnvWhenOptionUnset() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        SetVar("CSP_REPORT_ONLY", "true");
        var app = new App();
        app.EnableCsp();
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Equal("default-src 'self'", reply.HeaderValue("Content-Security-Policy-Report-Only"));
    }

    [Fact]
    public void OptionReportOnlyOverridesEnv() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        SetVar("CSP_REPORT_ONLY", "true");
        var app = new App();
        app.EnableCsp(new CspOptions { ReportOnly = false });
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Equal("default-src 'self'", reply.HeaderValue("Content-Security-Policy"));
        Assert.Null(reply.HeaderValue("Content-Security-Policy-Report-Only"));
    }

    [Fact]
    public void ConfigIsASingletonInjectedIntoPolicy() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        var app = new App();

        var config = app.Container.Get<CspConfig>();
        var policy = app.Container.Get<CspPolicy>();

        Assert.Same(config, app.Container.Get<CspConfig>());
        Assert.Same(policy, app.Container.Get<CspPolicy>());
        Assert.Contains(new KeyValuePair<string, string>("default-src", "'self'"), config.Directives);
        Assert.True(policy.Has("default-src"));
    }

    [Theory]
    [InlineData("CSP_DEFAULT_SRC", "default-src 'self'")]
    [InlineData("CSP_SCRIPT_SRC", "script-src 'self'")]
    [InlineData("CSP_SCRIPT_SRC_ELEM", "script-src-elem 'self'")]
    [InlineData("CSP_SCRIPT_SRC_ATTR", "script-src-attr 'self'")]
    [InlineData("CSP_STYLE_SRC", "style-src 'self'")]
    [InlineData("CSP_STYLE_SRC_ELEM", "style-src-elem 'self'")]
    [InlineData("CSP_STYLE_SRC_ATTR", "style-src-attr 'self'")]
    [InlineData("CSP_IMG_SRC", "img-src 'self'")]
    [InlineData("CSP_FONT_SRC", "font-src 'self'")]
    [InlineData("CSP_CONNECT_SRC", "connect-src 'self'")]
    [InlineData("CSP_MEDIA_SRC", "media-src 'self'")]
    [InlineData("CSP_OBJECT_SRC", "object-src 'self'")]
    [InlineData("CSP_CHILD_SRC", "child-src 'self'")]
    [InlineData("CSP_FRAME_SRC", "frame-src 'self'")]
    [InlineData("CSP_WORKER_SRC", "worker-src 'self'")]
    [InlineData("CSP_MANIFEST_SRC", "manifest-src 'self'")]
    [InlineData("CSP_PREFETCH_SRC", "prefetch-src 'self'")]
    [InlineData("CSP_BASE_URI", "base-uri 'self'")]
    [InlineData("CSP_FORM_ACTION", "form-action 'self'")]
    [InlineData("CSP_FRAME_ANCESTORS", "frame-ancestors 'self'")]
    [InlineData("CSP_SANDBOX", "sandbox allow-forms")]
    [InlineData("CSP_REPORT_URI", "report-uri /csp")]
    [InlineData("CSP_REPORT_TO", "report-to csp-endpoint")]
    [InlineData("CSP_REQUIRE_TRUSTED_TYPES_FOR", "require-trusted-types-for 'script'")]
    [InlineData("CSP_TRUSTED_TYPES", "trusted-types app-policy")]
    [InlineData("CSP_UPGRADE_INSECURE_REQUESTS", "upgrade-insecure-requests")]
    [InlineData("CSP_BLOCK_ALL_MIXED_CONTENT", "block-all-mixed-content")]
    public void EachEnvKeyMapsToExactDirective(string key, string expected) {
        var value = IsBoolean(key) ? "true" : expected[(expected.IndexOf(' ') + 1)..];
        SetVar(key, value);
        Assert.Equal(expected, new CspPolicy(new CspConfig()).ToHeader());
    }

    [Fact]
    public void ConfigExposesDirectivesInCanonicalOrder() {
        SetVar("CSP_SCRIPT_SRC", "'self'");
        SetVar("CSP_DEFAULT_SRC", "'self'");
        SetVar("CSP_UPGRADE_INSECURE_REQUESTS", "true");
        var config = new CspConfig();
        Assert.Equal(
            new[] { "default-src", "script-src", "upgrade-insecure-requests" },
            config.Directives.Select(d => d.Key));
    }

    [Theory]
    [InlineData("true", true)]
    [InlineData("1", true)]
    [InlineData("false", false)]
    [InlineData(null, false)]
    public void ConfigReportOnlyFromEnv(string? raw, bool expected) {
        if (raw is not null)
            SetVar("CSP_REPORT_ONLY", raw);
        Assert.Equal(expected, new CspConfig().ReportOnly);
    }

    [Fact]
    public void ApplyDoesNotOverrideExistingReportOnlyHeader() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: true);
        var reply = Reply.Text("ok").Header("Content-Security-Policy-Report-Only", "default-src 'none'");
        Csp.Apply(reply);
        Assert.Equal("default-src 'none'", reply.HeaderValue("Content-Security-Policy-Report-Only"));
    }

    [Fact]
    public void ResetDisablesAndClearsPolicy() {
        SetVar("CSP_DEFAULT_SRC", "'self'");
        Csp.Configure(new CspPolicy(new CspConfig()), reportOnly: false);
        Csp.Enable();
        Assert.True(Csp.Enabled);

        Csp.Reset();

        Assert.False(Csp.Enabled);
        var reply = Reply.Text("ok");
        Csp.Apply(reply);
        Assert.Null(reply.HeaderValue("Content-Security-Policy"));
    }
}
