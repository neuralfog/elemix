namespace Hydris.Validation;

[ValidationRule]
internal sealed class Required : Rule {
    public override string? Check(in Value value) {
        bool empty;
        if (value.Raw is null)
            empty = true;
        else if (value.IsString(out var text))
            empty = text.Trim().Length == 0;
        else
            empty = value.IsEmpty;

        return empty ? $"The {value.Field} field is required." : null;
    }
}

[ValidationRule]
internal sealed class Filled : Rule {
    public override string? Check(in Value value) {
        if (value.Raw is null)
            return null;
        var empty = value.IsString(out var text) ? text.Trim().Length == 0 : value.IsEmpty;
        return empty ? $"The {value.Field} field must have a value." : null;
    }
}
