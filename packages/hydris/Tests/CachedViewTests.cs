using System.IO.Compression;
using System.Text;
using Hydris.Http;
using Hydris.Renderer;

namespace Hydris.Tests;

public sealed class CachedViewTests {
    private static byte[] Body(int size) => Encoding.UTF8.GetBytes(new string('x', size));

    [Fact]
    public void ExposesHtmlUnchanged() {
        var html = Body(128);

        Assert.Same(html, new CachedView(html).Html);
    }

    [Fact]
    public void MemoizesEachEncoding() {
        var view = new CachedView(Body(4000));

        Assert.Same(view.Encoded(ContentEncoding.Brotli), view.Encoded(ContentEncoding.Brotli));
        Assert.Same(view.Encoded(ContentEncoding.Gzip), view.Encoded(ContentEncoding.Gzip));
    }

    [Fact]
    public void BrotliAndGzipAreDistinctAndSmaller() {
        var html = Body(4000);
        var view = new CachedView(html);

        var brotli = view.Encoded(ContentEncoding.Brotli);
        var gzip = view.Encoded(ContentEncoding.Gzip);

        Assert.True(brotli.Length < html.Length);
        Assert.True(gzip.Length < html.Length);
        Assert.NotEqual(brotli, gzip);
    }

    [Fact]
    public void BrotliRoundTripsToOriginal() {
        var html = Body(4000);

        var brotli = new CachedView(html).Encoded(ContentEncoding.Brotli);
        var buffer = new byte[8192];
        BrotliDecoder.TryDecompress(brotli, buffer, out var written);

        Assert.Equal(html, buffer[..written]);
    }
}
