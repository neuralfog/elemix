using System.Buffers;
using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.IO.Hashing;
using System.Runtime.InteropServices;

namespace Hydris.Http;

internal sealed class RenderCache<TValue> : IDisposable {
    private const int StackLimit = 1024;
    private const long Never = long.MaxValue;

    private readonly ConcurrentDictionary<UInt128, Entry> Entries = new();
    private readonly long TtlMs;
    private readonly int MaxEntries;
    private readonly Timer Reaper;

    internal RenderCache(TimeSpan ttl, TimeSpan reap, int maxEntries) {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(ttl.Ticks);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(reap.Ticks);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxEntries);
        TtlMs = (long)ttl.TotalMilliseconds;
        MaxEntries = maxEntries;
        Reaper = new Timer(static state => {
            if (state is RenderCache<TValue> cache) {
                cache.Reap();
            }
        }, this, reap, reap);
    }

    internal int Count => Entries.Count;

    internal static UInt128 Key(string view, string viewData, string stores, string context) {
        Debug.Assert(view is not null);
        Debug.Assert(viewData is not null);
        Debug.Assert(stores is not null);
        Debug.Assert(context is not null);
        var bytes = (view.Length + viewData.Length + stores.Length + context.Length) * 2 + 16;
        var rented = bytes > StackLimit ? ArrayPool<byte>.Shared.Rent(bytes) : null;
        try {
            var span = (rented is null ? stackalloc byte[StackLimit] : rented)[..bytes];
            var pos = 0;
            pos += WriteField(span[pos..], view);
            pos += WriteField(span[pos..], viewData);
            pos += WriteField(span[pos..], stores);
            pos += WriteField(span[pos..], context);
            return XxHash128.HashToUInt128(span[..pos]);
        } finally {
            if (rented is not null) {
                ArrayPool<byte>.Shared.Return(rented);
            }
        }
    }

    private static int WriteField(Span<byte> destination, string value) {
        BinaryPrimitives.WriteInt32LittleEndian(destination, value.Length);
        var source = MemoryMarshal.AsBytes(value.AsSpan());
        source.CopyTo(destination[4..]);
        return 4 + source.Length;
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

    internal void Set(UInt128 key, TValue value) {
        Entries[key] = new Entry(value, Environment.TickCount64 + TtlMs);
        Trim();
    }

    internal void SetForever(UInt128 key, TValue value) {
        Entries[key] = new Entry(value, Never);
        Trim();
    }

    private void Trim() {
        while (Entries.Count > MaxEntries) {
            var removed = false;
            foreach (var pair in Entries) {
                if (Entries.TryRemove(pair)) {
                    removed = true;
                    break;
                }
            }
            if (!removed)
                break;
        }
    }

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
