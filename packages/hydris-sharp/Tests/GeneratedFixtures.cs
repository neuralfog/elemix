using Hydris.Container;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Routing;

namespace Hydris.Tests;

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
    [Use(typeof(GenMw))]
    public Reply Index() => Reply.Text("gen");

    [Get("/gen/api")]
    [Json]
    public Reply Api() => Reply.Text("api");
}
