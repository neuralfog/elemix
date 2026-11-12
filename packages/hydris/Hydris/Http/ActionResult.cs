namespace Hydris.Http;

public static class ActionResult {
    public static ActionResult<T> Of<T>(T value) where T : IViewData => new(value);
}

public sealed class ActionResult<T> where T : IViewData {
    private readonly Dictionary<string, string> HeaderMap = new();

    public ActionResult(T value) {
        ArgumentNullException.ThrowIfNull(value);
        Value = value;
    }

    public T Value { get; }

    public int StatusCode { get; private set; } = 200;

    internal IReadOnlyDictionary<string, string> Headers => HeaderMap;

    public ActionResult<T> Status(int code) {
        StatusCode = code;
        return this;
    }

    public ActionResult<T> Header(string name, string value) {
        ArgumentException.ThrowIfNullOrEmpty(name);
        HeaderMap[name] = value;
        return this;
    }
}
