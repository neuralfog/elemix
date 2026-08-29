using Hydris.Container;
using Hydris.Http;

namespace Hydris.Middleware;

public static class Pipeline {
    public static Task<Reply> Run(DiContainer scope, IReadOnlyList<Type> middlewares, Func<Task<Reply>> handler) {
        if (middlewares.Count == 0)
            return handler();
        return new Walk(scope, middlewares, handler).Step();
    }

    private sealed class Walk {
        private readonly DiContainer Scope;
        private readonly IReadOnlyList<Type> Middlewares;
        private readonly Func<Task<Reply>> Handler;
        private readonly Next Advance;
        private int Index;

        public Walk(DiContainer scope, IReadOnlyList<Type> middlewares, Func<Task<Reply>> handler) {
            Scope = scope;
            Middlewares = middlewares;
            Handler = handler;
            Advance = Step;
        }

        public Task<Reply> Step() {
            if (Index == Middlewares.Count)
                return Handler();
            var middleware = (IMiddleware)Scope.Get(Middlewares[Index++]);
            return middleware.Handle(Advance);
        }
    }
}
