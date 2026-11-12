using System.Text.RegularExpressions;

namespace Hydris.Validation;

[ValidationRule]
internal sealed class Alpha : Rule {
    private static readonly Regex AsciiOnly = new(@"\A[a-zA-Z]+\z");
    private static readonly Regex Unicode = new(@"\A[\p{L}\p{M}]+\z");

    public override string? Check(in Value value) {
        var ascii = value.Args.Length > 0 && value.Args[0] == "ascii";
        return value.IsString(out var s) && (ascii ? AsciiOnly : Unicode).IsMatch(s)
            ? null
            : $"The {value.Field} field must only contain letters.";
    }
}

[ValidationRule]
internal sealed class AlphaNum : Rule {
    private static readonly Regex AsciiOnly = new(@"\A[a-zA-Z0-9]+\z");
    private static readonly Regex Unicode = new(@"\A[\p{L}\p{M}\p{N}]+\z");

    public override string? Check(in Value value) {
        var ascii = value.Args.Length > 0 && value.Args[0] == "ascii";
        return value.IsString(out var s) && (ascii ? AsciiOnly : Unicode).IsMatch(s)
            ? null
            : $"The {value.Field} field must only contain letters and numbers.";
    }
}

[ValidationRule]
internal sealed class AlphaDash : Rule {
    private static readonly Regex AsciiOnly = new(@"\A[a-zA-Z0-9_-]+\z");
    private static readonly Regex Unicode = new(@"\A[\p{L}\p{M}\p{N}_-]+\z");

    public override string? Check(in Value value) {
        var ascii = value.Args.Length > 0 && value.Args[0] == "ascii";
        return value.IsString(out var s) && (ascii ? AsciiOnly : Unicode).IsMatch(s)
            ? null
            : $"The {value.Field} field must only contain letters, numbers, dashes and underscores.";
    }
}

[ValidationRule]
internal sealed class Ascii : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && System.Text.Ascii.IsValid(s)
            ? null
            : $"The {value.Field} field must only contain single-byte alphanumeric characters and symbols.";
}

[ValidationRule]
internal sealed class Lowercase : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && string.Equals(s, s.ToLowerInvariant(), StringComparison.Ordinal)
            ? null
            : $"The {value.Field} field must be lowercase.";
}

[ValidationRule]
internal sealed class Uppercase : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && string.Equals(s, s.ToUpperInvariant(), StringComparison.Ordinal)
            ? null
            : $"The {value.Field} field must be uppercase.";
}
