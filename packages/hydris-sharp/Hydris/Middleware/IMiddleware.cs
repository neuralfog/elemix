using Hydris.Http;

namespace Hydris.Middleware;

public delegate Task<Reply> Next();

public interface IMiddleware {
    Task<Reply> Handle(Next next);
}
