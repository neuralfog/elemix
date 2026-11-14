using Hydris.Http;

namespace Hydris.Tests;

public sealed class RenderCacheTests {
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Reap = TimeSpan.FromMinutes(5);

    [Fact]
    public void EntriesAreCappedUnderFloodOfUniqueKeys() {
        using var cache = new RenderCache<string>(Ttl, Reap, maxEntries: 8);
        for (var i = 0; i < 500; i++)
            cache.Set(RenderCache<string>.Key("v", i.ToString(), string.Empty, string.Empty), "html");

        Assert.True(cache.Count <= 8, $"cache grew to {cache.Count}");
    }

    [Fact]
    public void SetForeverIsAlsoCapped() {
        using var cache = new RenderCache<string>(Ttl, Reap, maxEntries: 4);
        for (var i = 0; i < 100; i++)
            cache.SetForever(RenderCache<string>.Key("v", i.ToString(), string.Empty, string.Empty), "html");

        Assert.True(cache.Count <= 4, $"cache grew to {cache.Count}");
    }

    [Fact]
    public void KeyIsNotCollidableByShiftingFieldBoundaries() {
        var a = RenderCache<string>.Key("ab", "c", "x", "y");
        var b = RenderCache<string>.Key("a", "bc", "x", "y");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void StoredValueIsRetrievableWithinCap() {
        using var cache = new RenderCache<string>(Ttl, Reap, maxEntries: 16);
        var key = RenderCache<string>.Key("v", "data", string.Empty, string.Empty);
        cache.Set(key, "payload");

        Assert.True(cache.TryGet(key, out var value));
        Assert.Equal("payload", value);
    }
}
