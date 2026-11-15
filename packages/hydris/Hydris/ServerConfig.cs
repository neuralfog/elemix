using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace Hydris;

public sealed record ServerConfig {
    public string Host { get; init; } = "127.0.0.1";
    public int Port { get; init; } = 5000;
    public ServerTls? Tls { get; init; }
    public long? MaxRequestBodyBytes { get; init; }
    public long? MaxConcurrentConnections { get; init; }
    public int? MaxRequestHeaderCount { get; init; }
    public TimeSpan? KeepAliveTimeout { get; init; }
    public TimeSpan? RequestHeadersTimeout { get; init; }
    public HttpProtocols? Protocols { get; init; }
}

public sealed record ServerTls {
    public string? PfxPath { get; init; }
    public string? PfxPassword { get; init; }
    public string? PemCertPath { get; init; }
    public string? PemKeyPath { get; init; }
}
