using Hydris.Container;
using Hydris.Example.Middlewares;
using Hydris.Example.Services;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;

namespace Hydris.Example.Handlers;

[ViewData]
public sealed partial record Greeting(string User);

[ViewData]
public sealed partial record HomeData(string Title);

[Handler]
[Middleware<PoweredBy>]
public sealed class HelloHandler(UserService users) {
    [Get("/")]
    [Middleware<Audit>]
    public Reply Index() => Reply.View("Views/Pages/HelloWorld", new Greeting(users.Find("1"))).NoCache();

    [Get("/lorem-1k")]
    public Reply Lorem() => Reply.View("Views/Pages/LoremPage").NoCache();

    [Get("/test-render")]
    public Reply TestRender() =>
        Reply.View("Views/Pages/HomePage", new HomeData("Users, rendered on the server")).NoCache();
}
