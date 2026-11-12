namespace Hydris.Validation;

[ValidationRule]
internal sealed class In : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (string.Equals(arg, s, StringComparison.Ordinal))
                return null;
        }
        return $"The selected {value.Field} is invalid.";
    }
}

[ValidationRule]
internal sealed class NotIn : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (string.Equals(arg, s, StringComparison.Ordinal))
                return $"The selected {value.Field} is invalid.";
        }
        return null;
    }
}

[ValidationRule]
internal sealed class StartsWith : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (s.StartsWith(arg, StringComparison.Ordinal))
                return null;
        }
        return $"The {value.Field} field must start with one of the following: {string.Join(", ", value.Args.ToArray())}.";
    }
}

[ValidationRule]
internal sealed class EndsWith : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (s.EndsWith(arg, StringComparison.Ordinal))
                return null;
        }
        return $"The {value.Field} field must end with one of the following: {string.Join(", ", value.Args.ToArray())}.";
    }
}

[ValidationRule]
internal sealed class DoesntStartWith : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (s.StartsWith(arg, StringComparison.Ordinal))
                return $"The {value.Field} field must not start with one of the following: {string.Join(", ", value.Args.ToArray())}.";
        }
        return null;
    }
}

[ValidationRule]
internal sealed class DoesntEndWith : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        foreach (var arg in value.Args) {
            if (s.EndsWith(arg, StringComparison.Ordinal))
                return $"The {value.Field} field must not end with one of the following: {string.Join(", ", value.Args.ToArray())}.";
        }
        return null;
    }
}
