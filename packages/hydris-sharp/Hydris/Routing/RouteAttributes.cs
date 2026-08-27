namespace Hydris.Routing;

[AttributeUsage(AttributeTargets.Method)]
public sealed class GetAttribute(string path) : Attribute {
    public string Path { get; } = path;
}

[AttributeUsage(AttributeTargets.Method)]
public sealed class PostAttribute(string path) : Attribute {
    public string Path { get; } = path;
}

[AttributeUsage(AttributeTargets.Method)]
public sealed class PutAttribute(string path) : Attribute {
    public string Path { get; } = path;
}

[AttributeUsage(AttributeTargets.Method)]
public sealed class PatchAttribute(string path) : Attribute {
    public string Path { get; } = path;
}

[AttributeUsage(AttributeTargets.Method)]
public sealed class DeleteAttribute(string path) : Attribute {
    public string Path { get; } = path;
}
