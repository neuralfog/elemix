using System.Text;

namespace Hydris.Http;

public sealed class CspPolicy {
    private readonly Dictionary<string, string> Map;
    private readonly string Rendered;

    public CspPolicy(CspConfig config) {
        ArgumentNullException.ThrowIfNull(config);

        Map = new Dictionary<string, string>(StringComparer.Ordinal);
        var builder = new StringBuilder();
        foreach (var (name, value) in config.Directives) {
            Map[name] = value;
            if (builder.Length > 0)
                builder.Append("; ");
            builder.Append(name);
            if (value.Length > 0)
                builder.Append(' ').Append(value);
        }
        Rendered = builder.ToString();
    }

    public bool IsEmpty => Map.Count == 0;

    public bool Has(string directive) => Map.ContainsKey(directive);

    public string? Get(string directive) => Map.GetValueOrDefault(directive);

    public string ToHeader() => Rendered;
}
