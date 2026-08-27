using Hydris.Container;
using Hydris.Http;
using Hydris.Routing;

namespace AotSmoke;

[Handler]
public sealed class Hello {
    [Get("/")]
    public Reply Index() =>
        Reply.Html("<!doctype html><html><body><h1>Hello, World!</h1></body></html>");
}
