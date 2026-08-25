import { DiContainer } from '../container/DiContainer';
import { ServiceProvider } from '../container/ServiceProvider';
import { CookieAuthority } from '../http/CookieAuthority';
import { Request } from '../http/Request';
import { Csrf } from '../middleware/Csrf';
import { MatchedRoute } from '../routing/MatchedRoute';

export class CoreServiceProvider extends ServiceProvider {
    private static readonly HTTP_SCOPE_HINT =
        'these tokens are only available inside an HTTP request scope';

    register(container: DiContainer): void {
        container.contextTokens(
            'http',
            [Request, MatchedRoute],
            CoreServiceProvider.HTTP_SCOPE_HINT,
        );
        container.scoped(
            CookieAuthority,
            (c) => new CookieAuthority(c.get(Request)),
        );
        container.transient(Csrf, (c) => new Csrf(c.get(CookieAuthority)));
    }

    static requestScope(container: DiContainer, req: Request): DiContainer {
        const scope = container.scope();
        scope.value(DiContainer, scope);
        scope.value(Request, req);
        if (req.route) scope.value(MatchedRoute, req.route);
        return scope;
    }
}
