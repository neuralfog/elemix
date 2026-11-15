using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace Hydris;

internal static class ServerConfigMapper {
    internal static void Configure(KestrelServerOptions kestrel, ServerConfig config, long defaultMaxBody) {
        ArgumentNullException.ThrowIfNull(kestrel);
        ArgumentNullException.ThrowIfNull(config);

        ApplyLimits(kestrel.Limits, config, defaultMaxBody);
        kestrel.Listen(ResolveHost(config.Host), config.Port, listen => {
            if (config.Protocols is { } protocols)
                listen.Protocols = protocols;
            if (config.Tls is { } tls)
                listen.UseHttps(https => https.ServerCertificate = LoadCertificate(tls));
        });
    }

    internal static IPAddress ResolveHost(string host) {
        if (string.IsNullOrWhiteSpace(host))
            return IPAddress.Loopback;
        return host.Trim().ToLowerInvariant() switch {
            "localhost" => IPAddress.Loopback,
            "*" or "0.0.0.0" or "any" => IPAddress.Any,
            "::" or "[::]" or "any6" => IPAddress.IPv6Any,
            _ => IPAddress.Parse(host),
        };
    }

    internal static void ApplyLimits(KestrelServerLimits limits, ServerConfig config, long defaultMaxBody) {
        limits.MaxRequestBodySize = config.MaxRequestBodyBytes ?? defaultMaxBody;
        if (config.MaxConcurrentConnections is { } connections)
            limits.MaxConcurrentConnections = connections;
        if (config.MaxRequestHeaderCount is { } headerCount)
            limits.MaxRequestHeaderCount = headerCount;
        if (config.KeepAliveTimeout is { } keepAlive)
            limits.KeepAliveTimeout = keepAlive;
        if (config.RequestHeadersTimeout is { } requestHeaders)
            limits.RequestHeadersTimeout = requestHeaders;
    }

    internal static X509Certificate2 LoadCertificate(ServerTls tls) {
        ArgumentNullException.ThrowIfNull(tls);
        if (!string.IsNullOrEmpty(tls.PfxPath))
            return X509CertificateLoader.LoadPkcs12FromFile(tls.PfxPath, tls.PfxPassword);
        if (!string.IsNullOrEmpty(tls.PemCertPath) && !string.IsNullOrEmpty(tls.PemKeyPath))
            return X509Certificate2.CreateFromPemFile(tls.PemCertPath, tls.PemKeyPath);
        throw new ArgumentException("ServerTls requires PfxPath, or both PemCertPath and PemKeyPath");
    }
}
