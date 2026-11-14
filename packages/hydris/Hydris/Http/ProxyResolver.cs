namespace Hydris.Http;

internal static class ProxyResolver {
    public static string ResolveIp(Request request, string socketIp, bool trustProxy) {
        if (trustProxy) {
            var forwarded = request.Header(HeaderNames.XForwardedFor);
            if (!string.IsNullOrEmpty(forwarded))
                return Last(forwarded);
        }

        return socketIp;
    }

    public static string ResolveProtocol(Request request, string scheme, bool trustProxy) {
        if (trustProxy) {
            var forwarded = request.Header(HeaderNames.XForwardedProto);
            if (!string.IsNullOrEmpty(forwarded))
                return Last(forwarded);
        }

        return scheme;
    }

    private static string Last(string value) {
        var comma = value.LastIndexOf(',');
        return (comma >= 0 ? value[(comma + 1)..] : value).Trim();
    }
}
