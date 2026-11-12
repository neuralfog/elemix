namespace Hydris.Validation;

[AttributeUsage(AttributeTargets.Class)]
public sealed class ValidationRuleAttribute : Attribute {
    public ValidationRuleAttribute() { }

    public ValidationRuleAttribute(string name) => Name = name;

    public string? Name { get; }
}
