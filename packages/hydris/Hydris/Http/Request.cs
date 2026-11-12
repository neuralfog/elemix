using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Http;

public sealed class Request(
    Method method,
    string path,
    IReadOnlyDictionary<string, string> parameters,
    IHeaderDictionary headers) {
    private Dictionary<string, object?>? BagStore;
    private IReadOnlyDictionary<string, string>? CookieJar;
    private Guid? IdValue;

    public Guid Id => IdValue ??= Guid.CreateVersion7();
    public Method Method { get; } = method;
    public string Path { get; } = path;
    public IReadOnlyDictionary<string, string> Params { get; } = parameters;
    public IHeaderDictionary Headers { get; } = headers;
    public IDictionary<string, object?> Bag => BagStore ??= [];
    public IReadOnlyDictionary<string, string> Cookies => CookieJar ??= CookieAuthority.Parse(Header("Cookie"));
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
}
