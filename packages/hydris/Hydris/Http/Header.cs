namespace Hydris.Http;

public static class HeaderNames {
    public const string Accept = "Accept";
    public const string AcceptEncoding = "Accept-Encoding";
    public const string Allow = "Allow";
    public const string CacheControl = "Cache-Control";
    public const string ContentDisposition = "Content-Disposition";
    public const string ContentEncoding = "Content-Encoding";
    public const string ContentLength = "Content-Length";
    public const string ContentSecurityPolicy = "Content-Security-Policy";
    public const string ContentSecurityPolicyReportOnly = "Content-Security-Policy-Report-Only";
    public const string ContentType = "Content-Type";
    public const string Cookie = "Cookie";
    public const string CrossOriginEmbedderPolicy = "Cross-Origin-Embedder-Policy";
    public const string CrossOriginOpenerPolicy = "Cross-Origin-Opener-Policy";
    public const string CrossOriginResourcePolicy = "Cross-Origin-Resource-Policy";
    public const string ETag = "ETag";
    public const string IfNoneMatch = "If-None-Match";
    public const string Location = "Location";
    public const string PermissionsPolicy = "Permissions-Policy";
    public const string ReferrerPolicy = "Referrer-Policy";
    public const string SetCookie = "Set-Cookie";
    public const string StrictTransportSecurity = "Strict-Transport-Security";
    public const string Vary = "Vary";
    public const string XContentTypeOptions = "X-Content-Type-Options";
    public const string XFrameOptions = "X-Frame-Options";
    public const string XHydrisCsrf = "X-Hydris-Csrf";
    public const string CfConnectingIp = "CF-Connecting-IP";
    public const string TrueClientIp = "True-Client-IP";
    public const string XForwardedFor = "X-Forwarded-For";
    public const string XForwardedProto = "X-Forwarded-Proto";
}

public static class CacheDirective {
    public const string NoCache = "no-cache";
    public const string Public = "public";
    public const string Immutable = "immutable";
    public const string MaxAge = "max-age";
}
