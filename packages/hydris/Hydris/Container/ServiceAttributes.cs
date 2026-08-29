namespace Hydris.Container;

[AttributeUsage(AttributeTargets.Class)]
public sealed class SingletonAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class)]
public sealed class ScopedAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class)]
public sealed class TransientAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class)]
public sealed class HandlerAttribute : Attribute;
