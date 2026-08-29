namespace Hydris.Routing;

internal sealed class RouteTree {
    private readonly Node Root = new();

    public void Insert(Route route) {
        var node = Root;
        foreach (var segment in route.Segments) {
            node = segment.Kind switch {
                SegmentKind.Static => node.GetStatic(segment.Text),
                SegmentKind.Param => node.GetParam(),
                _ => node.GetWildcard(),
            };
            if (segment.Kind == SegmentKind.Wildcard)
                break;
        }

        node.Add(route);
    }

    public Route? Find(Method method, ReadOnlySpan<char> path, ReadOnlySpan<Range> segments) =>
        Search(Root, path, segments, 0, method);

    private static Route? Search(Node node, ReadOnlySpan<char> path, ReadOnlySpan<Range> segments, int index, Method method) {
        if (index == segments.Length)
            return node.Pick(method) ?? node.WildcardNode?.Pick(method);

        var part = path[segments[index]];

        if (node.TryGetStatic(part, out var staticChild)) {
            var hit = Search(staticChild, path, segments, index + 1, method);
            if (hit is not null)
                return hit;
        }

        if (node.ParamNode is not null) {
            var hit = Search(node.ParamNode, path, segments, index + 1, method);
            if (hit is not null)
                return hit;
        }

        return node.WildcardNode?.Pick(method);
    }

    private sealed class Node {
        private Dictionary<string, Node>? StaticChildren;
        private List<Route>? Routes;

        public Node? ParamNode { get; private set; }
        public Node? WildcardNode { get; private set; }

        public Node GetStatic(string key) {
            StaticChildren ??= new Dictionary<string, Node>(StringComparer.Ordinal);
            if (!StaticChildren.TryGetValue(key, out var child)) {
                child = new Node();
                StaticChildren[key] = child;
            }

            return child;
        }

        public Node GetParam() => ParamNode ??= new Node();

        public Node GetWildcard() => WildcardNode ??= new Node();

        public bool TryGetStatic(ReadOnlySpan<char> key, out Node child) {
            if (StaticChildren is not null)
                return StaticChildren.GetAlternateLookup<ReadOnlySpan<char>>().TryGetValue(key, out child!);
            child = null!;
            return false;
        }

        public void Add(Route route) => (Routes ??= []).Add(route);

        public Route? Pick(Method method) {
            if (Routes is null)
                return null;
            foreach (var route in Routes) {
                if (route.Method == method)
                    return route;
            }

            return null;
        }
    }
}
