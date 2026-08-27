using Hydris.Container;
using Hydris.Http;

namespace Hydris.Middleware;

public static class Pipeline {
    public static Task<Reply> Run(DiContainer scope, IReadOnlyList<Type> middlewares, Func<Task<Reply>> handler) {
        return Step(0);

        Task<Reply> Step(int index) {
            if (index == middlewares.Count)
                return handler();
            var middleware = (IMiddleware)scope.Get(middlewares[index]);
            return middleware.Handle(() => Step(index + 1));
        }
    }
}
