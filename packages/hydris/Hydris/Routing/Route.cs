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

    public IReadOnlyDictionary<string, string>? Match(ReadOnlySpan<char> path, ReadOnlySpan<Range> segments) {
        Dictionary<string, string>? parameters = null;
        for (var i = 0; i < Segments.Length; i++) {
            var segment = Segments[i];

            if (segment.Kind == SegmentKind.Wildcard) {
                var rest = new string[segments.Length - i];
                for (var j = i; j < segments.Length; j++)
                    rest[j - i] = Uri.UnescapeDataString(path[segments[j]].ToString());
                (parameters ??= [])["*"] = string.Join('/', rest);
                return parameters;
            }

            if (i >= segments.Length)
                return null;

            if (segment.Kind == SegmentKind.Param)
                (parameters ??= [])[segment.Text] = Uri.UnescapeDataString(path[segments[i]].ToString());
            else if (!path[segments[i]].SequenceEqual(segment.Text))
                return null;
        }

        return segments.Length == Segments.Length ? parameters ?? EmptyParams : null;
    }

    private static readonly IReadOnlyDictionary<string, string> EmptyParams = new Dictionary<string, string>();

    private static string[] SegmentsOf(string path) {
        var query = path.IndexOf('?');
        var clean = query >= 0 ? path[..query] : path;
        return clean.Split('/', StringSplitOptions.RemoveEmptyEntries);
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
