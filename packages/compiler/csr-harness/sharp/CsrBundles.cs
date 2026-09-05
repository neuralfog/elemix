using System.Collections.Frozen;

namespace Hydris.Harness;

internal sealed class CsrBundles {
    private readonly FrozenDictionary<string, string> Map;

    private CsrBundles(FrozenDictionary<string, string> map) => Map = map;

    public string? Resolve(string component) =>
        Map.TryGetValue(component, out var file) ? $"/csr/{file}" : null;

    public static CsrBundles Load(string dir) {
        ArgumentException.ThrowIfNullOrEmpty(dir);
        if (!Directory.Exists(dir))
            return new CsrBundles(FrozenDictionary<string, string>.Empty);

        var map = new Dictionary<string, string>();
        foreach (var path in Directory.EnumerateFiles(dir, "*.js")) {
            var file = Path.GetFileName(path);
            var stem = Path.GetFileNameWithoutExtension(file);
            var component = stem.Length > 9 && stem[^9] == '-' ? stem[..^9] : stem;
            map[component] = file;
        }
        return new CsrBundles(map.ToFrozenDictionary());
    }
}
