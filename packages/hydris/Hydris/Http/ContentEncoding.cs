namespace Hydris.Http;

public enum ContentEncoding {
    Brotli,
    Gzip,
}

public static class ContentEncodings {
    public static string Token(this ContentEncoding encoding) => encoding switch {
        ContentEncoding.Brotli => "br",
        ContentEncoding.Gzip => "gzip",
        _ => "gzip",
    };

    public static string Extension(this ContentEncoding encoding) => encoding switch {
        ContentEncoding.Brotli => ".br",
        ContentEncoding.Gzip => ".gz",
        _ => ".gz",
    };
}
