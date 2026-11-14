namespace Hydris.Http;

public sealed record SecurityHeadersConfig {
    private static readonly (string Key, string Name)[] Catalog = [
        ("SECURITY_HSTS", HeaderNames.StrictTransportSecurity),
        ("SECURITY_CONTENT_TYPE_OPTIONS", HeaderNames.XContentTypeOptions),
        ("SECURITY_REFERRER_POLICY", HeaderNames.ReferrerPolicy),
        ("SECURITY_FRAME_OPTIONS", HeaderNames.XFrameOptions),
        ("SECURITY_PERMISSIONS_POLICY", HeaderNames.PermissionsPolicy),
        ("SECURITY_CROSS_ORIGIN_OPENER_POLICY", HeaderNames.CrossOriginOpenerPolicy),
        ("SECURITY_CROSS_ORIGIN_EMBEDDER_POLICY", HeaderNames.CrossOriginEmbedderPolicy),
        ("SECURITY_CROSS_ORIGIN_RESOURCE_POLICY", HeaderNames.CrossOriginResourcePolicy),
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
