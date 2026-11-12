using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Http;

public sealed class Request(
    Method method,
    string path,
    IReadOnlyDictionary<string, string> parameters,
    IHeaderDictionary headers) {
    private static readonly IReadOnlyDictionary<string, string> Empty =
        new Dictionary<string, string>();

    private Dictionary<string, object?>? BagStore;
    private IReadOnlyDictionary<string, string>? CookieJar;
    private IReadOnlyDictionary<string, string>? QueryBag;
    private Guid? IdValue;

    public Guid Id => IdValue ??= Guid.CreateVersion7();
    public Method Method { get; } = method;
    public string Path { get; } = path;
    public IReadOnlyDictionary<string, string> Params { get; } = parameters;
    public IHeaderDictionary Headers { get; } = headers;
    public IDictionary<string, object?> Bag => BagStore ??= [];
    public IReadOnlyDictionary<string, string> Cookies => CookieJar ??= CookieAuthority.Parse(Header("Cookie"));
    public IReadOnlyDictionary<string, string> QueryValues => QueryBag ??= ParseQuery(Query);
    public string Ip { get; internal set; } = string.Empty;
    public string Protocol { get; internal set; } = string.Empty;
    public string Query { get; internal set; } = string.Empty;

    internal Stream? BodyStream { get; set; }
    internal CancellationToken Aborted { get; set; }

    public async ValueTask<byte[]> ReadBodyAsync() {
        if (BodyStream is null)
            return [];
        using var buffer = new MemoryStream();
        await BodyStream.CopyToAsync(buffer, Aborted);
        return buffer.ToArray();
    }

    public string? Param(string name) => Params.TryGetValue(name, out var value) ? value : null;

    public string? Header(string name) => Headers.TryGetValue(name, out var value) ? value.ToString() : null;

    public string? Cookie(string name) => Cookies.TryGetValue(name, out var value) ? value : null;

    public string? QueryValue(string name) => QueryValues.TryGetValue(name, out var value) ? value : null;

    private static IReadOnlyDictionary<string, string> ParseQuery(string query) {
        if (string.IsNullOrEmpty(query))
            return Empty;
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        var span = query[0] == '?' ? query.AsSpan(1) : query.AsSpan();
        foreach (var range in span.Split('&')) {
            var pair = span[range];
            if (pair.IsEmpty)
                continue;
            var eq = pair.IndexOf('=');
            var key = eq < 0 ? pair : pair[..eq];
            var value = eq < 0 ? [] : pair[(eq + 1)..];
            result[Decode(key)] = Decode(value);
        }

        return result;
    }

    private static string Decode(ReadOnlySpan<char> value) =>
        Uri.UnescapeDataString(value.ToString().Replace('+', ' '));
}
