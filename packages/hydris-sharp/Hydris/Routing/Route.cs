using Hydris.Container;
using Hydris.Http;

namespace Hydris.Routing;

internal enum SegmentKind {
    Static,
    Param,
    Wildcard,
}

internal readonly record struct Segment(SegmentKind Kind, string Text);

internal sealed class Route(
    Method method,
    string path,
    Func<DiContainer, Task<Reply>> handler,
    IReadOnlyList<Type> middlewares,
    bool json) {
    public Method Method { get; } = method;
    public string Path { get; } = path;
    public Func<DiContainer, Task<Reply>> Handler { get; } = handler;
    public IReadOnlyList<Type> Middlewares { get; } = middlewares;
    public bool Json { get; } = json;

    internal Segment[] Segments { get; } = Compile(path);

    public static string[] SegmentsOf(string path) {
        var query = path.IndexOf('?');
        var clean = query >= 0 ? path[..query] : path;
        return clean.Split('/', StringSplitOptions.RemoveEmptyEntries);
    }

    public Dictionary<string, string>? Match(string[] parts) {
        var parameters = new Dictionary<string, string>();
        for (var i = 0; i < Segments.Length; i++) {
            var segment = Segments[i];

            if (segment.Kind == SegmentKind.Wildcard) {
                var rest = new string[parts.Length - i];
                for (var j = i; j < parts.Length; j++)
                    rest[j - i] = Uri.UnescapeDataString(parts[j]);
                parameters["*"] = string.Join('/', rest);
                return parameters;
            }

            if (i >= parts.Length)
                return null;

            if (segment.Kind == SegmentKind.Param)
                parameters[segment.Text] = Uri.UnescapeDataString(parts[i]);
            else if (segment.Text != parts[i])
                return null;
        }

        return parts.Length == Segments.Length ? parameters : null;
    }

    private static Segment[] Compile(string path) {
        var parts = SegmentsOf(path);
        var segments = new Segment[parts.Length];
        for (var i = 0; i < parts.Length; i++) {
            segments[i] = parts[i] switch {
                "*" => new Segment(SegmentKind.Wildcard, string.Empty),
                [':', .. var name] => new Segment(SegmentKind.Param, name),
                var value => new Segment(SegmentKind.Static, value),
            };
        }

        return segments;
    }
}
