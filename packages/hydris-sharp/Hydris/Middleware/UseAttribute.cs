namespace Hydris.Middleware;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class UseAttribute(Type middleware) : Attribute {
    public Type Middleware { get; } = middleware;
}
