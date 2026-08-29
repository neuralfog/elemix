using Hydris.Container;
using Hydris.Error;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;

namespace Hydris.Example;

[Singleton]
public sealed class UserService {
    public string Find(string id) => $"user #{id}: Ada Lovelace";
}

[Handler]
public sealed class UserController(UserService users, Request request) {

    [Get("/test-render")]
    public Reply TestRender() =>
        Reply.View("Views/Pages/HomePage", new HomeData("Users, rendered on the server")).NoCache();

    [Get("/lorem-1k")]
    public Reply Lorem() => Reply.View("Views/Pages/LoremPage").NoCache();

    [Get("/about")]
    public Reply About() => Reply.View("Views/Pages/AboutPage");

    [Get("/")]
    public Reply Index() => Reply.Text("hello and world");

    [Get("/users/:id")]
    [Middleware<Audit>]
    public Reply Show() => Reply.Text(users.Find(request.Param("id") ?? "unknown"));

    [Get("/boom")]
    public Reply Boom() => throw new InvalidOperationException("kaboom");

    [Get("/teapot")]
    public Reply Teapot() => throw new HttpException(418, "I'm a teapot");

    [Get("/api/boom")]
    [Json]
    public Reply ApiBoom() => throw new InvalidOperationException("api down");

    [Get("/file")]
    public Reply ServeFile() => Reply.File("assets/hello.txt");

    [Get("/download")]
    public Reply DownloadFile() => Reply.FileDownload("assets/hello.txt", "greeting.txt");

    [Get("/bytes")]
    public Reply Bytes() => Reply.Binary([1, 2, 3, 4, 5]);
}

[Handler]
public sealed class SessionController(CookieAuthority cookies) {
    [Get("/login")]
    public Reply Login() {
        var reply = Reply.Text("logged in");
        cookies.SetCookie(reply, "sid", "user-42", new CookieOptions { HttpOnly = true });
        return reply;
    }

    [Get("/me")]
    public Reply Me() => Reply.Text(cookies.Get("sid") ?? "anonymous");
}
