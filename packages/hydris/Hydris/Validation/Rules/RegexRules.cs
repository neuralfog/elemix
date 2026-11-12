using System.Text.RegularExpressions;

namespace Hydris.Validation;

[ValidationRule("regex")]
internal sealed class RegexRule : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && Regex.IsMatch(s, value.Text(0))
            ? null
            : $"The {value.Field} field format is invalid.";
}

[ValidationRule("not_regex")]
internal sealed class NotRegexRule : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && Regex.IsMatch(s, value.Text(0))
            ? $"The {value.Field} field format is invalid."
            : null;
}
