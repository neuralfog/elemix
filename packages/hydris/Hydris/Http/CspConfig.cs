namespace Hydris.Http;

public sealed record CspConfig {
    private static readonly (string Key, string Name, bool Boolean)[] Catalog = [
        ("CSP_DEFAULT_SRC", "default-src", false),
        ("CSP_SCRIPT_SRC", "script-src", false),
        ("CSP_SCRIPT_SRC_ELEM", "script-src-elem", false),
        ("CSP_SCRIPT_SRC_ATTR", "script-src-attr", false),
        ("CSP_STYLE_SRC", "style-src", false),
        ("CSP_STYLE_SRC_ELEM", "style-src-elem", false),
        ("CSP_STYLE_SRC_ATTR", "style-src-attr", false),
        ("CSP_IMG_SRC", "img-src", false),
        ("CSP_FONT_SRC", "font-src", false),
        ("CSP_CONNECT_SRC", "connect-src", false),
        ("CSP_MEDIA_SRC", "media-src", false),
        ("CSP_OBJECT_SRC", "object-src", false),
        ("CSP_CHILD_SRC", "child-src", false),
        ("CSP_FRAME_SRC", "frame-src", false),
        ("CSP_WORKER_SRC", "worker-src", false),
        ("CSP_MANIFEST_SRC", "manifest-src", false),
        ("CSP_PREFETCH_SRC", "prefetch-src", false),
        ("CSP_BASE_URI", "base-uri", false),
        ("CSP_FORM_ACTION", "form-action", false),
        ("CSP_FRAME_ANCESTORS", "frame-ancestors", false),
        ("CSP_SANDBOX", "sandbox", false),
        ("CSP_REPORT_URI", "report-uri", false),
        ("CSP_REPORT_TO", "report-to", false),
        ("CSP_REQUIRE_TRUSTED_TYPES_FOR", "require-trusted-types-for", false),
        ("CSP_TRUSTED_TYPES", "trusted-types", false),
        ("CSP_UPGRADE_INSECURE_REQUESTS", "upgrade-insecure-requests", true),
        ("CSP_BLOCK_ALL_MIXED_CONTENT", "block-all-mixed-content", true),
    ];

    public IReadOnlyList<KeyValuePair<string, string>> Directives { get; }
    public bool ReportOnly { get; }

    public CspConfig() {
        var directives = new List<KeyValuePair<string, string>>();
        foreach (var (key, name, boolean) in Catalog) {
            if (boolean) {
                if (Env.Bool(key, false))
                    directives.Add(new KeyValuePair<string, string>(name, string.Empty));
            } else {
                var value = Env.Get(key, string.Empty);
                if (value.Length > 0)
                    directives.Add(new KeyValuePair<string, string>(name, value));
            }
        }
        Directives = directives;
        ReportOnly = Env.Bool("CSP_REPORT_ONLY", false);
    }
}
