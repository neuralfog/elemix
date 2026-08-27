using Hydris.Container;
using Hydris.Error;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;

namespace Hydris.Sample;

[Singleton]
public sealed class UserService {
    public string Find(string id) => $"user #{id}: Ada Lovelace";
}

[Handler]
[Use(typeof(Tenant))]
public sealed class UserController(UserService users, Request request) {
    [Get("/")]
    public Reply Index() => Reply.Text("hello from hydris");

    [Get("/users/:id")]
    [Use(typeof(Audit))]
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
