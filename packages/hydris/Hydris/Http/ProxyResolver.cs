namespace Hydris.Http;

internal static class ProxyResolver {
    private static readonly string[] ForwardedIpHeaders =
        [HeaderNames.CfConnectingIp, HeaderNames.TrueClientIp, HeaderNames.XForwardedFor];

    public static string ResolveIp(Request request, string socketIp, bool trustProxy) {
        if (trustProxy) {
            foreach (var header in ForwardedIpHeaders) {
                var value = request.Header(header);
                if (!string.IsNullOrEmpty(value))
                    return First(value);
            }
        }

        return socketIp;
    }

    public static string ResolveProtocol(Request request, string scheme, bool trustProxy) {
        if (trustProxy) {
            var forwarded = request.Header(HeaderNames.XForwardedProto);
            if (!string.IsNullOrEmpty(forwarded))
                return First(forwarded);
        }

        return scheme;
    }

    private static string First(string value) {
        var comma = value.IndexOf(',');
        return (comma >= 0 ? value[..comma] : value).Trim();
    }
}
