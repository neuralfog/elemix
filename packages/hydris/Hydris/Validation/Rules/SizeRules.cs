namespace Hydris.Validation;

[ValidationRule]
internal sealed class Min : Rule {
    public override string? Check(in Value value) =>
        value.Size() >= value.Number(0)
            ? null
            : $"The {value.Field} field must be at least {value.Text(0)}.";
}

[ValidationRule]
internal sealed class Max : Rule {
    public override string? Check(in Value value) =>
        value.Size() <= value.Number(0)
            ? null
            : $"The {value.Field} field must not be greater than {value.Text(0)}.";
}

[ValidationRule]
internal sealed class Between : Rule {
    public override string? Check(in Value value) {
        var size = value.Size();
        return size >= value.Number(0) && size <= value.Number(1)
            ? null
            : $"The {value.Field} field must be between {value.Text(0)} and {value.Text(1)}.";
    }
}

[ValidationRule]
internal sealed class Size : Rule {
    public override string? Check(in Value value) =>
        value.Size() == value.Number(0)
            ? null
            : $"The {value.Field} field must be {value.Text(0)}.";
}
