namespace Hydris.Middleware;

[AttributeUsage(AttributeTargets.Class)]
public sealed class MiddlewareAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class MiddlewareAttribute<T> : Attribute where T : IMiddleware;
