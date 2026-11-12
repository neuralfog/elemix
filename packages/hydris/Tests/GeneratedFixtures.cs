using Hydris.Container;
using Hydris.Contracts;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;

namespace Hydris.Tests;

[Contract]
internal sealed partial record GenEcho(string Value, int Number);

internal enum Shade {
    Light,
    Dark,
}

[Contract]
internal sealed partial record StrictReq([Hydris.Validation.Required] string Name);

[Contract]
internal sealed partial record Painted(string Shade, bool On, string Id);

[Handler]
internal sealed class GenBind {
    [Get("/gen-bind/user/:id")]
    [Action]
    public GenEcho GetUser(string id) => new(id, 0);

    [Get("/gen-bind/search")]
    [Action]
    public GenEcho Search(string? q, int page) => new(q ?? "none", page);

    [Post("/gen-bind/make")]
    [Action]
    public ActionResult<GenEcho> Make() =>
        ActionResult.Of(new GenEcho("made", 1)).Status(201).Header("X-Made", "yes");

    [Post("/gen-bind/strict")]
    [Action]
    public GenEcho Strict(StrictReq input) => new(input.Name, 1);

    [Get("/gen-bind/paint")]
    [Action]
    public Painted Paint(Shade shade, bool on, Guid id) =>
        new(shade.ToString(), on, id.ToString());
}

[Middleware]
internal sealed class GenMw : IMiddleware {
    public Task<Reply> Handle(Next next) => next();
}

[Singleton]
internal sealed class GenLogger {
    public string Tag => "log";
}

[Singleton]
internal sealed class GenDb(GenLogger logger) {
    public GenLogger Logger { get; } = logger;
}

[Scoped]
internal sealed class GenRepo(GenDb db) {
    public GenDb Db { get; } = db;
}

[Transient]
internal sealed class GenJob {
    public int Id { get; } = 1;
}

[Handler]
internal sealed class GenHandler(GenDb db) {
    public GenDb Db { get; } = db;
}

[Handler]
internal sealed class GenController(GenDb db) {
    public GenDb Db { get; } = db;

    [Get("/gen")]
    [Middleware<GenMw>]
    public Reply Index() => Reply.Text("gen");

    [Get("/gen/api")]
    [Json]
    public Reply Api() => Reply.Text("api");
}
