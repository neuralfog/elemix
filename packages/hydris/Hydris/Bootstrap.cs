using Hydris.Container;
using Hydris.Routing;

namespace Hydris;

public static class Bootstrap {
    private static readonly List<Action<DiContainer>> ServiceRegistrars = [];
    private static readonly List<Action<Router>> RouteRegistrars = [];

    public static void RegisterServices(Action<DiContainer> registrar) => ServiceRegistrars.Add(registrar);

    public static void RegisterRoutes(Action<Router> registrar) => RouteRegistrars.Add(registrar);

    internal static void ApplyServices(DiContainer container) {
        foreach (var registrar in ServiceRegistrars)
            registrar(container);
    }

    internal static void ApplyRoutes(Router router) {
        foreach (var registrar in RouteRegistrars)
            registrar(router);
    }
}
