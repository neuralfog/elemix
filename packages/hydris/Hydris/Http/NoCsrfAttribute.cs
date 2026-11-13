namespace Hydris.Http;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class NoCsrfAttribute : Attribute;
