using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text;

namespace Hydris;

public sealed class EnvException(string message) : Exception(message);

public static class Env {
    private static readonly (string Suffix, double Millis)[] DurationUnits = [
        ("ms", 1d),
        ("s", 1_000d),
        ("m", 60_000d),
        ("h", 3_600_000d),
        ("d", 86_400_000d),
    ];

    public static void Load(params string[] paths) => Apply(paths, overwrite: false);

    public static void Overload(params string[] paths) => Apply(paths, overwrite: true);

    public static void Require(params string[] names) {
        ArgumentNullException.ThrowIfNull(names);
        List<string>? missing = null;
        foreach (var name in names) {
            if (!Has(name))
                (missing ??= []).Add(name);
        }
        if (missing is not null)
            throw new EnvException($"missing required env variables: {string.Join(", ", missing)}");
    }

    public static bool Has(string name) => Raw(name) is not null;

    public static bool TryGet(string name, [NotNullWhen(true)] out string? value) {
        value = Raw(name);
        return value is not null;
    }

    public static string Get(string name) => Raw(name) ?? throw Missing(name);

    public static string Get(string name, string fallback) => Raw(name) ?? fallback;

    public static int Int(string name) =>
        int.TryParse(Get(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : throw Invalid(name, "int");

    public static int Int(string name, int fallback) => Raw(name) is null ? fallback : Int(name);

    public static long Long(string name) =>
        long.TryParse(Get(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : throw Invalid(name, "long");

    public static long Long(string name, long fallback) => Raw(name) is null ? fallback : Long(name);

    public static double Double(string name) =>
        double.TryParse(Get(name), NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? value
            : throw Invalid(name, "double");

    public static double Double(string name, double fallback) => Raw(name) is null ? fallback : Double(name);

    public static decimal Decimal(string name) =>
        decimal.TryParse(Get(name), NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
            ? value
            : throw Invalid(name, "decimal");

    public static decimal Decimal(string name, decimal fallback) => Raw(name) is null ? fallback : Decimal(name);

    public static bool Bool(string name) => ParseBool(Get(name)) ?? throw Invalid(name, "bool");

    public static bool Bool(string name, bool fallback) => Raw(name) is null ? fallback : Bool(name);

    public static TimeSpan Duration(string name) => ParseDuration(Get(name)) ?? throw Invalid(name, "duration");

    public static TimeSpan Duration(string name, TimeSpan fallback) => Raw(name) is null ? fallback : Duration(name);

    public static System.Guid Guid(string name) =>
        System.Guid.TryParse(Get(name), out var value) ? value : throw Invalid(name, "guid");

    public static System.Uri Uri(string name) =>
        System.Uri.TryCreate(Get(name), UriKind.Absolute, out var value) ? value : throw Invalid(name, "absolute uri");

    public static TEnum Enum<TEnum>(string name) where TEnum : struct, System.Enum =>
        System.Enum.TryParse<TEnum>(Get(name), ignoreCase: true, out var value)
            ? value
            : throw Invalid(name, typeof(TEnum).Name);

    public static TEnum Enum<TEnum>(string name, TEnum fallback) where TEnum : struct, System.Enum =>
        Raw(name) is null ? fallback : Enum<TEnum>(name);

    public static string[] List(string name, char separator = ',') {
        var raw = Raw(name);
        return raw is null
            ? []
            : raw.Split(separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private static string? Raw(string name) {
        ArgumentException.ThrowIfNullOrEmpty(name);
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrEmpty(value) ? null : value;
    }

    private static void Apply(string[] paths, bool overwrite) {
        if (paths.Length == 0) {
            DotEnvFile.Load(".env", overwrite);
            return;
        }
        foreach (var path in paths)
            DotEnvFile.Load(path, overwrite);
    }

    private static bool? ParseBool(string value) => value.Trim().ToLowerInvariant() switch {
        "1" or "true" or "t" or "yes" or "y" or "on" => true,
        "0" or "false" or "f" or "no" or "n" or "off" => false,
        _ => null,
    };

    private static TimeSpan? ParseDuration(string value) {
        var text = value.Trim();
        if (text.Length == 0)
            return null;

        foreach (var (suffix, millis) in DurationUnits) {
            if (text.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) {
                var number = text[..^suffix.Length].Trim();
                return double.TryParse(number, NumberStyles.Float, CultureInfo.InvariantCulture, out var amount)
                    ? TimeSpan.FromMilliseconds(amount * millis)
                    : null;
            }
        }

        if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds))
            return TimeSpan.FromSeconds(seconds);

        return TimeSpan.TryParse(text, CultureInfo.InvariantCulture, out var span) ? span : null;
    }

    private static EnvException Missing(string name) =>
        new($"env variable is not defined: {name}");

    private static EnvException Invalid(string name, string type) =>
        new($"env variable {name} is not a valid {type}: '{Environment.GetEnvironmentVariable(name)}'");
}

file static class DotEnvFile {
    public static void Load(string path, bool overwrite) {
        ArgumentException.ThrowIfNullOrEmpty(path);
        if (!File.Exists(path))
            return;

        foreach (var line in File.ReadLines(path)) {
            if (!TryParse(line, out var key, out var value))
                continue;
            if (!overwrite && Environment.GetEnvironmentVariable(key) is not null)
                continue;
            Environment.SetEnvironmentVariable(key, value);
        }
    }

    private static bool TryParse(string line, out string key, out string value) {
        key = string.Empty;
        value = string.Empty;

        var text = line.Trim();
        if (text.Length == 0 || text[0] == '#')
            return false;
        if (text.StartsWith("export ", StringComparison.Ordinal))
            text = text[7..].TrimStart();

        var equals = text.IndexOf('=');
        if (equals <= 0)
            return false;

        key = text[..equals].TrimEnd();
        if (!IsValidKey(key))
            return false;

        value = Unquote(text[(equals + 1)..].Trim());
        return true;
    }

    private static string Unquote(string raw) {
        if (raw.Length >= 2 && raw[0] == '"' && raw[^1] == '"')
            return Expand(Unescape(raw[1..^1]));
        if (raw.Length >= 2 && raw[0] == '\'' && raw[^1] == '\'')
            return raw[1..^1];

        var comment = raw.IndexOf(" #", StringComparison.Ordinal);
        var bare = comment >= 0 ? raw[..comment].TrimEnd() : raw;
        return Expand(bare);
    }

    private static string Unescape(string body) {
        if (body.IndexOf('\\') < 0)
            return body;

        var builder = new StringBuilder(body.Length);
        for (var i = 0; i < body.Length; i++) {
            var current = body[i];
            if (current == '\\' && i + 1 < body.Length) {
                var next = body[++i];
                builder.Append(next switch {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    '"' => '"',
                    '\\' => '\\',
                    _ => next,
                });
                continue;
            }
            builder.Append(current);
        }
        return builder.ToString();
    }

    private static string Expand(string value) {
        if (!value.Contains("${", StringComparison.Ordinal))
            return value;

        var builder = new StringBuilder(value.Length);
        for (var i = 0; i < value.Length; i++) {
            if (value[i] == '$' && i + 1 < value.Length && value[i + 1] == '{') {
                var end = value.IndexOf('}', i + 2);
                if (end > i + 1) {
                    var name = value[(i + 2)..end];
                    builder.Append(name.Length == 0 ? string.Empty : Environment.GetEnvironmentVariable(name) ?? string.Empty);
                    i = end;
                    continue;
                }
            }
            builder.Append(value[i]);
        }
        return builder.ToString();
    }

    private static bool IsValidKey(string key) {
        if (key.Length == 0 || char.IsDigit(key[0]))
            return false;
        foreach (var c in key) {
            if (!char.IsLetterOrDigit(c) && c != '_')
                return false;
        }
        return true;
    }
}
