using Hydris.Http;
using Hydris.Middleware;

namespace Hydris.Example.Middlewares;

[Middleware]
public sealed class Audit : IMiddleware {
    public async Task<Reply> Handle(Next next) => (await next()).Header("X-Audited", "yes");
}
