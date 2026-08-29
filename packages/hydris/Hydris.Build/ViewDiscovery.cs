using System.Text.RegularExpressions;

namespace Hydris.Build;

public readonly record struct View(string Key, string Source, string? Export, bool Exists);

public static partial class ViewDiscovery {
    [GeneratedRegex(@"Reply\s*\.\s*View\s*\(\s*""([^""]+)""")]
    private static partial Regex ViewCall();

    private static readonly string[] SkipSegments = ["obj", "bin", "node_modules", ".git"];

    public static IReadOnlyList<View> Scan(string root, string viewsRoot) {
        ArgumentException.ThrowIfNullOrEmpty(root);
        ArgumentException.ThrowIfNullOrEmpty(viewsRoot);
        var keys = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var file in Sources(root)) {
            foreach (Match match in ViewCall().Matches(File.ReadAllText(file)))
                keys.Add(match.Groups[1].Value);
        }

        var views = new List<View>(keys.Count);
        foreach (var key in keys) {
            var at = key.IndexOf('@', StringComparison.Ordinal);
            var filePart = at < 0 ? key : key[..at];
            var export = at < 0 ? null : key[(at + 1)..];
            var source = Path.Combine(viewsRoot, filePart.Replace('/', Path.DirectorySeparatorChar) + ".ts");
            views.Add(new View(key, source, export, File.Exists(source)));
        }

        return views;
    }

    private static IEnumerable<string> Sources(string root) {
        foreach (var file in Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)) {
            if (!Skipped(file))
                yield return file;
        }
    }

    private static bool Skipped(string path) {
        foreach (var segment in SkipSegments) {
            if (path.Contains($"{Path.DirectorySeparatorChar}{segment}{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
                return true;
        }

        return false;
    }
}
