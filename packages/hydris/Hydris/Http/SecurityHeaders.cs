namespace Hydris.Http;

public sealed class SecurityHeaders {
    private readonly IReadOnlyList<KeyValuePair<string, string>> HeaderList;

    public SecurityHeaders(SecurityHeadersConfig config) {
        ArgumentNullException.ThrowIfNull(config);
        HeaderList = config.Headers;
    }

    public bool IsEmpty => HeaderList.Count == 0;

    public bool Has(string name) {
        foreach (var header in HeaderList) {
            if (header.Key == name)
                return true;
        }
        return false;
    }

    public string? Get(string name) {
        foreach (var header in HeaderList) {
            if (header.Key == name)
                return header.Value;
        }
        return null;
    }

    internal IReadOnlyList<KeyValuePair<string, string>> All => HeaderList;
}
