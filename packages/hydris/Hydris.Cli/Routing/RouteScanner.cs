using System.Text.RegularExpressions;

namespace Hydris.Cli.Routing;

public readonly record struct RouteInfo(string Method, string Path, string Handler);

public readonly record struct RouteRow(RouteInfo Route, bool Duplicate);

public static partial class RouteScanner {
    [GeneratedRegex(@"\bclass\s+(\w+)")]
    private static partial Regex ClassPattern();

    [GeneratedRegex(@"\[\s*(?:[\w.]+\.)?(Get|Post|Put|Patch|Delete)(?:Attribute)?\s*\(\s*""([^""]*)""")]
    private static partial Regex RoutePattern();

    public static IReadOnlyList<RouteInfo> Scan(string source) {
        ArgumentNullException.ThrowIfNull(source);

        var classes = ClassPattern().Matches(source);
        var routes = new List<RouteInfo>();
        foreach (Match route in RoutePattern().Matches(source)) {
            var handler = ContainingClass(classes, route.Index);
            routes.Add(new RouteInfo(route.Groups[1].Value, route.Groups[2].Value, handler));
        }
        return routes;
    }

    public static IReadOnlyList<RouteRow> Flag(IReadOnlyList<RouteInfo> routes) {
        ArgumentNullException.ThrowIfNull(routes);

        var counts = new Dictionary<(string, string), int>();
        foreach (var route in routes) {
            var key = (route.Method, route.Path);
            counts[key] = counts.TryGetValue(key, out var seen) ? seen + 1 : 1;
        }

        var rows = new List<RouteRow>(routes.Count);
        foreach (var route in routes)
            rows.Add(new RouteRow(route, counts[(route.Method, route.Path)] > 1));
        return rows;
    }

    public static IReadOnlyList<RouteInfo> ScanDirectory(string root) {
        ArgumentException.ThrowIfNullOrEmpty(root);

        var routes = new List<RouteInfo>();
        foreach (var file in Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)) {
            if (IsGenerated(file))
                continue;
            routes.AddRange(Scan(File.ReadAllText(file)));
        }
        return routes;
    }

    private static string ContainingClass(MatchCollection classes, int position) {
        var name = "?";
        foreach (Match candidate in classes) {
            if (candidate.Index >= position)
                break;
            name = candidate.Groups[1].Value;
        }
        return name;
    }

    private static bool IsGenerated(string path) =>
        path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal) ||
        path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal);
}
