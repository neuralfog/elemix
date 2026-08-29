using System.Buffers;
using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.IO.Hashing;
using System.Runtime.InteropServices;

namespace Hydris.Http;

internal sealed class RenderCache<TValue> : IDisposable {
    private const int StackLimit = 1024;
    private const long Never = long.MaxValue;

    private readonly ConcurrentDictionary<UInt128, Entry> Entries = new();
    private readonly long TtlMs;
    private readonly Timer Reaper;

    internal RenderCache(TimeSpan ttl, TimeSpan reap) {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(ttl.Ticks);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(reap.Ticks);
        TtlMs = (long)ttl.TotalMilliseconds;
        Reaper = new Timer(static state => {
            if (state is RenderCache<TValue> cache) {
                cache.Reap();
            }
        }, this, reap, reap);
    }

    internal int Count => Entries.Count;

    internal static UInt128 Key(string view, string viewData, string stores) {
        ArgumentNullException.ThrowIfNull(view);
        ArgumentNullException.ThrowIfNull(viewData);
        ArgumentNullException.ThrowIfNull(stores);
        var bytes = (view.Length + viewData.Length + stores.Length) * 2;
        var rented = bytes > StackLimit ? ArrayPool<byte>.Shared.Rent(bytes) : null;
        try {
            var span = (rented is null ? stackalloc byte[StackLimit] : rented)[..bytes];
            MemoryMarshal.AsBytes(view.AsSpan()).CopyTo(span);
            var pos = view.Length * 2;
            MemoryMarshal.AsBytes(viewData.AsSpan()).CopyTo(span[pos..]);
            pos += viewData.Length * 2;
            MemoryMarshal.AsBytes(stores.AsSpan()).CopyTo(span[pos..]);
            return XxHash128.HashToUInt128(span);
        } finally {
            if (rented is not null) {
                ArrayPool<byte>.Shared.Return(rented);
            }
        }
    }

    internal bool TryGet(UInt128 key, [MaybeNullWhen(false)] out TValue value) {
        if (Entries.TryGetValue(key, out var entry)) {
            if (Environment.TickCount64 <= entry.Expiry) {
                value = entry.Value;
                return true;
            }
            Entries.TryRemove(new KeyValuePair<UInt128, Entry>(key, entry));
        }
        value = default;
        return false;
    }

    internal void Set(UInt128 key, TValue value) =>
        Entries[key] = new Entry(value, Environment.TickCount64 + TtlMs);

    internal void SetForever(UInt128 key, TValue value) =>
        Entries[key] = new Entry(value, Never);

    private void Reap() {
        var now = Environment.TickCount64;
        foreach (var pair in Entries) {
            if (now > pair.Value.Expiry) {
                Entries.TryRemove(pair);
            }
        }
    }

    public void Dispose() => Reaper.Dispose();

    private readonly record struct Entry(TValue Value, long Expiry);
}
