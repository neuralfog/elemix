namespace Hydris.Validation;

[ValidationRule]
internal sealed class Filled : Rule {
    public override string? Check(in Value value) {
        if (value.Raw is null)
            return null;
        var empty = value.IsString(out var text) ? text.Trim().Length == 0 : value.IsEmpty;
        return empty ? $"The {value.Field} field must have a value." : null;
    }
}
