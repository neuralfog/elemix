namespace Hydris.Http;

public sealed record SecurityHeadersConfig {
    private static readonly (string Key, string Name)[] Catalog = [
        ("SECURITY_HSTS", "Strict-Transport-Security"),
        ("SECURITY_CONTENT_TYPE_OPTIONS", "X-Content-Type-Options"),
        ("SECURITY_REFERRER_POLICY", "Referrer-Policy"),
        ("SECURITY_FRAME_OPTIONS", "X-Frame-Options"),
        ("SECURITY_PERMISSIONS_POLICY", "Permissions-Policy"),
        ("SECURITY_CROSS_ORIGIN_OPENER_POLICY", "Cross-Origin-Opener-Policy"),
        ("SECURITY_CROSS_ORIGIN_EMBEDDER_POLICY", "Cross-Origin-Embedder-Policy"),
        ("SECURITY_CROSS_ORIGIN_RESOURCE_POLICY", "Cross-Origin-Resource-Policy"),
    ];

    public IReadOnlyList<KeyValuePair<string, string>> Headers { get; }

    public SecurityHeadersConfig() {
        var headers = new List<KeyValuePair<string, string>>();
        foreach (var (key, name) in Catalog) {
            var value = Env.Get(key, string.Empty);
            if (value.Length > 0)
                headers.Add(new KeyValuePair<string, string>(name, value));
        }
        Headers = headers;
    }
}
