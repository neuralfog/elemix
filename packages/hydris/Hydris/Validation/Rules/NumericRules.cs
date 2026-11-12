namespace Hydris.Validation;

[ValidationRule]
internal sealed class Digits : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        return AllDigits(s) && s.Length == (int)value.Number(0)
            ? null
            : $"The {value.Field} field must be {value.Text(0)} digits.";
    }

    internal static bool AllDigits(string s) {
        if (s.Length == 0)
            return false;
        foreach (var c in s) {
            if (c is < '0' or > '9')
                return false;
        }
        return true;
    }
}

[ValidationRule]
internal sealed class DigitsBetween : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        return Digits.AllDigits(s) && s.Length >= (int)value.Number(0) && s.Length <= (int)value.Number(1)
            ? null
            : $"The {value.Field} field must be between {value.Text(0)} and {value.Text(1)} digits.";
    }
}

[ValidationRule]
internal sealed class MinDigits : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        return Digits.AllDigits(s) && s.Length >= (int)value.Number(0)
            ? null
            : $"The {value.Field} field must have at least {value.Text(0)} digits.";
    }
}

[ValidationRule]
internal sealed class MaxDigits : Rule {
    public override string? Check(in Value value) {
        var s = value.Str();
        return Digits.AllDigits(s) && s.Length <= (int)value.Number(0)
            ? null
            : $"The {value.Field} field must not have more than {value.Text(0)} digits.";
    }
}

[ValidationRule]
internal sealed class MultipleOf : Rule {
    public override string? Check(in Value value) {
        if (!value.IsNumeric(out var n))
            return $"The {value.Field} field must be a multiple of {value.Text(0)}.";

        var factor = value.Number(0);
        if (factor == 0)
            return n == 0 ? null : $"The {value.Field} field must be a multiple of {value.Text(0)}.";

        var quotient = n / factor;
        return Math.Abs(quotient - Math.Round(quotient)) < 1e-9
            ? null
            : $"The {value.Field} field must be a multiple of {value.Text(0)}.";
    }
}
