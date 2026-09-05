using System.Diagnostics;
using Hydris.Http;

namespace Hydris.Renderer;

internal sealed class CachedView {
    private byte[]? Brotli;
    private byte[]? Gzip;

    public byte[] Html { get; }

    public CachedView(byte[] html) {
        Debug.Assert(html is not null);
        Html = html;
    }

    public byte[] Encoded(ContentEncoding encoding) =>
        encoding == ContentEncoding.Brotli
            ? Brotli ??= Compressor.Encode(Html, encoding)
            : Gzip ??= Compressor.Encode(Html, encoding);
}
