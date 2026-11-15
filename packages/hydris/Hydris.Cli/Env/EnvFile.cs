namespace Hydris.Cli.Env;

public static class EnvFile {
    public static Dictionary<string, string> Parse(string path) {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var raw in File.ReadLines(path)) {
            var line = raw.Trim();
            if (line.Length == 0 || line[0] == '#')
                continue;

            if (line.StartsWith("export ", StringComparison.Ordinal))
                line = line[7..].TrimStart();

            var eq = line.IndexOf('=');
            if (eq <= 0)
                continue;

            var key = line[..eq].Trim();
            var value = Unquote(line[(eq + 1)..].Trim());
            result[key] = value;
        }
        return result;
    }

    public static Dictionary<string, string> LoadDirectory(string directory) {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        if (string.IsNullOrEmpty(directory) || !Directory.Exists(directory))
            return result;

        var files = Directory.EnumerateFiles(directory)
            .Where(static path => path.EndsWith(".env", StringComparison.Ordinal))
            .ToArray();
        Array.Sort(files, StringComparer.Ordinal);

        foreach (var file in files) {
            foreach (var pair in Parse(file))
                result[pair.Key] = pair.Value;
        }
        return result;
    }

    public static Dictionary<string, string> ParsePair(string pair) {
        var eq = pair.IndexOf('=');
        if (eq <= 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);
        return new Dictionary<string, string>(StringComparer.Ordinal) {
            [pair[..eq]] = Unquote(pair[(eq + 1)..]),
        };
    }

    private static string Unquote(string value) {
        if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
            return value[1..^1];
        return value;
    }
}
