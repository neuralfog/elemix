using System.Collections.Frozen;
using System.Diagnostics;

namespace Hydris.Validation;

public static class Rules {
    private static readonly Dictionary<string, Rule> Pending = Builtins();
    private static FrozenDictionary<string, Rule>? Frozen;

    public static void Register(string name, Rule rule) {
        Debug.Assert(name is not null);
        Debug.Assert(rule is not null);
        Pending[name] = rule;
    }

    public static Rule? Resolve(string name) {
        Debug.Assert(name is not null);
        Frozen ??= Pending.ToFrozenDictionary(StringComparer.Ordinal);
        return Frozen.GetValueOrDefault(name);
    }

    public static string? Check(string name, in Value value) => Resolve(name)?.Check(value);

    private static Dictionary<string, Rule> Builtins() => new(StringComparer.Ordinal) {
        ["required"] = new Required(),
        ["filled"] = new Filled(),
        ["alpha"] = new Alpha(),
        ["alpha_num"] = new AlphaNum(),
        ["alpha_dash"] = new AlphaDash(),
        ["ascii"] = new Ascii(),
        ["lowercase"] = new Lowercase(),
        ["uppercase"] = new Uppercase(),
        ["min"] = new Min(),
        ["max"] = new Max(),
        ["between"] = new Between(),
        ["size"] = new Size(),
        ["in"] = new In(),
        ["not_in"] = new NotIn(),
        ["starts_with"] = new StartsWith(),
        ["ends_with"] = new EndsWith(),
        ["doesnt_start_with"] = new DoesntStartWith(),
        ["doesnt_end_with"] = new DoesntEndWith(),
        ["regex"] = new RegexRule(),
        ["not_regex"] = new NotRegexRule(),
        ["boolean"] = new Boolean(),
        ["integer"] = new Integer(),
        ["numeric"] = new Numeric(),
        ["string"] = new String(),
        ["digits"] = new Digits(),
        ["digits_between"] = new DigitsBetween(),
        ["min_digits"] = new MinDigits(),
        ["max_digits"] = new MaxDigits(),
        ["multiple_of"] = new MultipleOf(),
        ["email"] = new Email(),
        ["url"] = new Url(),
        ["uuid"] = new Uuid(),
        ["ulid"] = new Ulid(),
        ["ip"] = new Ip(),
        ["ipv4"] = new Ipv4(),
        ["ipv6"] = new Ipv6(),
        ["mac_address"] = new MacAddress(),
        ["json"] = new Json(),
        ["hex_color"] = new HexColor(),
        ["timezone"] = new Timezone(),
        ["date_format"] = new DateFormat(),
        ["decimal"] = new Decimal(),
    };
}
