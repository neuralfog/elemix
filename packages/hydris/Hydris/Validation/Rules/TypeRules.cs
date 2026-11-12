using System.Globalization;

namespace Hydris.Validation;

[ValidationRule]
internal sealed class Boolean : Rule {
    public override string? Check(in Value value) {
        var ok = value.Raw switch {
            bool => true,
            byte or sbyte or short or ushort or int or uint or long or ulong => Convert.ToInt64(value.Raw) is 0 or 1,
            string s => s is "0" or "1",
            _ => false,
        };
        return ok ? null : $"The {value.Field} field must be true or false.";
    }
}

[ValidationRule]
internal sealed class Integer : Rule {
    public override string? Check(in Value value) {
        var ok = value.Raw switch {
            byte or sbyte or short or ushort or int or uint or long or ulong => true,
            string s => long.TryParse(s, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out _),
            _ => false,
        };
        return ok ? null : $"The {value.Field} field must be an integer.";
    }
}

[ValidationRule]
internal sealed class Numeric : Rule {
    public override string? Check(in Value value) =>
        value.IsNumeric(out _) ? null : $"The {value.Field} field must be a number.";
}

[ValidationRule]
internal sealed class String : Rule {
    public override string? Check(in Value value) =>
        value.Raw is string ? null : $"The {value.Field} field must be a string.";
}
