namespace Hydris.Http;

internal static class Csp {
    private const string EnforceHeader = "Content-Security-Policy";
    private const string ReportHeader = "Content-Security-Policy-Report-Only";

    internal static bool Enabled { get; private set; }
    internal static bool ReportOnly { get; private set; }
    internal static string Policy { get; private set; } = string.Empty;

    internal static string HeaderName => ReportOnly ? ReportHeader : EnforceHeader;

    internal static void Configure(CspPolicy policy, bool reportOnly) {
        ArgumentNullException.ThrowIfNull(policy);
        Policy = policy.ToHeader();
        ReportOnly = reportOnly;
    }

    internal static void Enable() => Enabled = true;

    internal static void Apply(Reply reply) {
        if (Policy.Length == 0)
            return;
        if (reply.HeaderValue(EnforceHeader) is not null || reply.HeaderValue(ReportHeader) is not null)
            return;
        reply.Header(HeaderName, Policy);
    }

    internal static void Reset() {
        Enabled = false;
        ReportOnly = false;
        Policy = string.Empty;
    }
}
