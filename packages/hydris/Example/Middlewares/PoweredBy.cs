using Hydris.Http;
using Hydris.Middleware;

namespace Hydris.Example.Middlewares;

[Middleware]
public sealed class PoweredBy : IMiddleware {
    public async Task<Reply> Handle(Next next) {
        var reply = await next();
        return reply.Header("X-Powered-By", "hydris");
    }
}
