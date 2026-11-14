using Hydris.Renderer;

namespace Hydris.Tests;

public sealed class RenderErrorTests {
    [Fact]
    public void DetectsErrorSentinelAndExtractsMessage() {
        var isError = RenderError.TryRead("ERROR:boom at line 3"u8, out var message);

        Assert.True(isError);
        Assert.Equal("boom at line 3", message);
    }

    [Fact]
    public void NormalHtmlIsNotAnError() {
        var isError = RenderError.TryRead("<!doctype html><p>ok</p>"u8, out var message);

        Assert.False(isError);
        Assert.Equal(string.Empty, message);
    }

    [Fact]
    public void EmptyOutputIsNotAnError() {
        Assert.False(RenderError.TryRead(default, out _));
    }
}
