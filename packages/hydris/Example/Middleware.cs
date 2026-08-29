using Hydris.Container;
using Hydris.Http;
using Hydris.Middleware;

namespace Hydris.Example;

[Middleware]
public sealed class PoweredBy : IMiddleware {
    public async Task<Reply> Handle(Next next) {
        var reply = await next();
        return reply.Header("X-Powered-By", "hydris");
    }
}

[Middleware]
public sealed class RequestId(Request request) : IMiddleware {
    public async Task<Reply> Handle(Next next) {
        var reply = await next();
        return reply.Header("X-Request-Id", request.Id.ToString());
    }
}

[Middleware]
public sealed class Audit : IMiddleware {
    public async Task<Reply> Handle(Next next) => (await next()).Header("X-Audited", "yes");
}

[Middleware]
public sealed class Tenant : IMiddleware {
    public async Task<Reply> Handle(Next next) => (await next()).Header("X-Tenant", "acme");
}
