namespace Hydris.Contracts;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct, Inherited = false)]
public sealed class ContractAttribute : Attribute;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class RequiredAttribute : Attribute;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class LengthAttribute(int min, int max) : Attribute {
    public int Min { get; } = min;
    public int Max { get; } = max;
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class RangeAttribute(double min, double max) : Attribute {
    public double Min { get; } = min;
    public double Max { get; } = max;
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class PatternAttribute(string pattern) : Attribute {
    public string Pattern { get; } = pattern;
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class EmailAttribute : Attribute;
