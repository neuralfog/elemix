using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Hydris;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace Hydris.Tests;

public sealed class ServerConfigTests {
    [Fact]
    public void DefaultsAreLoopbackAndUnset() {
        var config = new ServerConfig();

        Assert.Equal("127.0.0.1", config.Host);
        Assert.Equal(5000, config.Port);
        Assert.Null(config.Tls);
        Assert.Null(config.MaxRequestBodyBytes);
        Assert.Null(config.MaxConcurrentConnections);
        Assert.Null(config.MaxRequestHeaderCount);
        Assert.Null(config.KeepAliveTimeout);
        Assert.Null(config.RequestHeadersTimeout);
        Assert.Null(config.Protocols);
    }

    [Theory]
    [InlineData("localhost")]
    [InlineData("")]
    [InlineData("   ")]
    public void ResolveHostLoopback(string host) =>
        Assert.Equal(IPAddress.Loopback, ServerConfigMapper.ResolveHost(host));

    [Theory]
    [InlineData("0.0.0.0")]
    [InlineData("*")]
    [InlineData("ANY")]
    public void ResolveHostAny(string host) =>
        Assert.Equal(IPAddress.Any, ServerConfigMapper.ResolveHost(host));

    [Fact]
    public void ResolveHostParsesExplicitIp() =>
        Assert.Equal(IPAddress.Parse("192.168.1.50"), ServerConfigMapper.ResolveHost("192.168.1.50"));

    [Fact]
    public void ResolveHostIPv6Any() =>
        Assert.Equal(IPAddress.IPv6Any, ServerConfigMapper.ResolveHost("::"));

    [Fact]
    public void ResolveHostRejectsHostname() =>
        Assert.Throws<FormatException>(() => ServerConfigMapper.ResolveHost("example.com"));

    [Fact]
    public void ApplyLimitsUsesDefaultBodyWhenUnset() {
        var kestrel = new KestrelServerOptions();

        ServerConfigMapper.ApplyLimits(kestrel.Limits, new ServerConfig(), 4096);

        Assert.Equal(4096, kestrel.Limits.MaxRequestBodySize);
    }

    [Fact]
    public void ApplyLimitsAppliesEveryOverride() {
        var kestrel = new KestrelServerOptions();
        var config = new ServerConfig {
            MaxRequestBodyBytes = 10,
            MaxConcurrentConnections = 20,
            MaxRequestHeaderCount = 30,
            KeepAliveTimeout = TimeSpan.FromSeconds(5),
            RequestHeadersTimeout = TimeSpan.FromSeconds(7),
        };

        ServerConfigMapper.ApplyLimits(kestrel.Limits, config, 999);

        Assert.Equal(10, kestrel.Limits.MaxRequestBodySize);
        Assert.Equal(20, kestrel.Limits.MaxConcurrentConnections);
        Assert.Equal(30, kestrel.Limits.MaxRequestHeaderCount);
        Assert.Equal(TimeSpan.FromSeconds(5), kestrel.Limits.KeepAliveTimeout);
        Assert.Equal(TimeSpan.FromSeconds(7), kestrel.Limits.RequestHeadersTimeout);
    }

    [Fact]
    public void ApplyLimitsLeavesUnsetOptionsAtKestrelDefaults() {
        var kestrel = new KestrelServerOptions();
        var defaultKeepAlive = kestrel.Limits.KeepAliveTimeout;
        var defaultHeaderCount = kestrel.Limits.MaxRequestHeaderCount;

        ServerConfigMapper.ApplyLimits(kestrel.Limits, new ServerConfig(), 4096);

        Assert.Equal(defaultKeepAlive, kestrel.Limits.KeepAliveTimeout);
        Assert.Equal(defaultHeaderCount, kestrel.Limits.MaxRequestHeaderCount);
        Assert.Null(kestrel.Limits.MaxConcurrentConnections);
    }

    [Fact]
    public void LoadCertificateRequiresPfxOrPem() {
        var ex = Assert.Throws<ArgumentException>(() => ServerConfigMapper.LoadCertificate(new ServerTls()));
        Assert.Contains("PfxPath", ex.Message);
    }

    [Fact]
    public void LoadCertificateReadsPfxFile() {
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("cn=hydris-test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(1));
        var path = Path.Combine(Path.GetTempPath(), $"hydris-{Guid.NewGuid():N}.pfx");
        File.WriteAllBytes(path, cert.Export(X509ContentType.Pfx, "secret"));

        try {
            using var loaded = ServerConfigMapper.LoadCertificate(new ServerTls { PfxPath = path, PfxPassword = "secret" });
            Assert.Equal(cert.Thumbprint, loaded.Thumbprint);
        } finally {
            File.Delete(path);
        }
    }

    [Fact]
    public void ConfigureAppliesLimitsWithoutThrowing() {
        var kestrel = new KestrelServerOptions();
        var config = new ServerConfig {
            Host = "127.0.0.1",
            Port = 8099,
            MaxConcurrentConnections = 42,
            Protocols = HttpProtocols.Http1,
        };

        ServerConfigMapper.Configure(kestrel, config, 4096);

        Assert.Equal(4096, kestrel.Limits.MaxRequestBodySize);
        Assert.Equal(42, kestrel.Limits.MaxConcurrentConnections);
    }
}
