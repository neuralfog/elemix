namespace Hydris.Http;

internal static class SecurityHeaderGate {
    private static IReadOnlyList<KeyValuePair<string, string>> Headers = [];

    internal static bool Enabled { get; private set; }

    internal static void Configure(SecurityHeaders headers) {
        ArgumentNullException.ThrowIfNull(headers);
        Headers = headers.All;
    }

    internal static void Enable() => Enabled = true;

    internal static void Apply(Reply reply) {
        foreach (var (name, value) in Headers) {
            if (reply.HeaderValue(name) is null)
                reply.Header(name, value);
        }
    }

    internal static void Reset() {
        Enabled = false;
        Headers = [];
    }
}
