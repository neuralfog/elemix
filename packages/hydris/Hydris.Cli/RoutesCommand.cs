using Hydris.Cli.Routing;

namespace Hydris.Cli;

public static class RoutesCommand {
    public static int Run() => Run(Directory.GetCurrentDirectory());

    public static int Run(string root) {
        var rows = RouteScanner.Flag(RouteScanner.ScanDirectory(root));

        Brand.Banner();
        if (rows.Count == 0) {
            Brand.Info("no routes found");
            Brand.Blank();
            return 0;
        }

        var ordered = new List<RouteRow>(rows);
        ordered.Sort(static (a, b) => {
            var byPath = string.CompareOrdinal(a.Route.Path, b.Route.Path);
            return byPath != 0 ? byPath : string.CompareOrdinal(a.Route.Method, b.Route.Method);
        });

        var methodWidth = Width("METHOD", ordered, static r => r.Route.Method);
        var pathWidth = Width("PATH", ordered, static r => r.Route.Path);
        var handlerWidth = Width("HANDLER", ordered, static r => r.Route.Handler);

        Brand.RouteHeader(methodWidth, pathWidth, handlerWidth);
        var duplicates = 0;
        foreach (var row in ordered) {
            if (row.Duplicate)
                duplicates++;
            Brand.RouteRow(row.Route.Method, row.Route.Path, row.Route.Handler, row.Duplicate, methodWidth, pathWidth, handlerWidth);
        }
        Brand.Blank();

        if (duplicates > 0) {
            Brand.Error("duplicate routes found");
            return 1;
        }
        return 0;
    }

    private static int Width(string header, List<RouteRow> rows, Func<RouteRow, string> select) {
        var max = header.Length;
        foreach (var row in rows)
            max = Math.Max(max, select(row).Length);
        return max;
    }
}
