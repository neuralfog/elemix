namespace Hydris.Validation;

public abstract class ValidationAttribute : Attribute {
    protected ValidationAttribute(params object[] args) => Args = args;

    public IReadOnlyList<object> Args { get; }
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = true)]
public sealed class RuleAttribute(string name, params object[] args) : ValidationAttribute(args) {
    public string Name { get; } = name;
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = true)]
public sealed class RuleAttribute<T>(params object[] args) : ValidationAttribute(args) where T : Rule;

public sealed class FilledAttribute : ValidationAttribute;
public sealed class EmailAttribute : ValidationAttribute;
public sealed class UrlAttribute : ValidationAttribute;
public sealed class UuidAttribute : ValidationAttribute;
public sealed class UlidAttribute : ValidationAttribute;
public sealed class IpAttribute : ValidationAttribute;
public sealed class Ipv4Attribute : ValidationAttribute;
public sealed class Ipv6Attribute : ValidationAttribute;
public sealed class MacAddressAttribute : ValidationAttribute;
public sealed class JsonAttribute : ValidationAttribute;
public sealed class HexColorAttribute : ValidationAttribute;
public sealed class TimezoneAttribute : ValidationAttribute;
public sealed class AlphaAttribute : ValidationAttribute;
public sealed class AlphaNumAttribute : ValidationAttribute;
public sealed class AlphaDashAttribute : ValidationAttribute;
public sealed class AsciiAttribute : ValidationAttribute;
public sealed class LowercaseAttribute : ValidationAttribute;
public sealed class UppercaseAttribute : ValidationAttribute;

public sealed class MinAttribute(double value) : ValidationAttribute(value);
public sealed class MaxAttribute(double value) : ValidationAttribute(value);
public sealed class SizeAttribute(double value) : ValidationAttribute(value);
public sealed class MultipleOfAttribute(double value) : ValidationAttribute(value);
public sealed class DigitsAttribute(int count) : ValidationAttribute(count);
public sealed class MinDigitsAttribute(int count) : ValidationAttribute(count);
public sealed class MaxDigitsAttribute(int count) : ValidationAttribute(count);
public sealed class BetweenAttribute(double min, double max) : ValidationAttribute(min, max);
public sealed class DigitsBetweenAttribute(int min, int max) : ValidationAttribute(min, max);

public sealed class DecimalAttribute : ValidationAttribute {
    public DecimalAttribute(int places) : base(places) { }

    public DecimalAttribute(int min, int max) : base(min, max) { }
}

public sealed class RegexAttribute(string pattern) : ValidationAttribute(pattern);
public sealed class NotRegexAttribute(string pattern) : ValidationAttribute(pattern);
public sealed class DateFormatAttribute(string format) : ValidationAttribute(format);

public sealed class InAttribute(params string[] values) : ValidationAttribute(values);
public sealed class NotInAttribute(params string[] values) : ValidationAttribute(values);
public sealed class StartsWithAttribute(params string[] values) : ValidationAttribute(values);
public sealed class EndsWithAttribute(params string[] values) : ValidationAttribute(values);
public sealed class DoesntStartWithAttribute(params string[] values) : ValidationAttribute(values);
public sealed class DoesntEndWithAttribute(params string[] values) : ValidationAttribute(values);
