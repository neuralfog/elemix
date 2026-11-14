using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Hydris.Validation;

[ValidationRule]
internal sealed partial class Email : Rule {
    [GeneratedRegex(@"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) =>
        value.IsString(out var s) && Pattern().IsMatch(s)
            ? null
            : $"The {value.Field} field must be a valid email address.";
}

[ValidationRule]
internal sealed class Url : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s)
        && Uri.TryCreate(s, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? null
            : $"The {value.Field} field must be a valid URL.";
}

[ValidationRule]
internal sealed partial class Uuid : Rule {
    [GeneratedRegex(@"^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) =>
        value.IsString(out var s) && Pattern().IsMatch(s)
            ? null
            : $"The {value.Field} field must be a valid UUID.";
}

[ValidationRule]
internal sealed partial class Ulid : Rule {
    [GeneratedRegex(@"^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) =>
        value.IsString(out var s) && Pattern().IsMatch(s)
            ? null
            : $"The {value.Field} field must be a valid ULID.";
}

[ValidationRule]
internal sealed class Ip : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && IPAddress.TryParse(s, out _)
            ? null
            : $"The {value.Field} field must be a valid IP address.";
}

[ValidationRule]
internal sealed class Ipv4 : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && IPAddress.TryParse(s, out var ip) && ip.AddressFamily == AddressFamily.InterNetwork
            ? null
            : $"The {value.Field} field must be a valid IPv4 address.";
}

[ValidationRule]
internal sealed class Ipv6 : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && IPAddress.TryParse(s, out var ip) && ip.AddressFamily == AddressFamily.InterNetworkV6
            ? null
            : $"The {value.Field} field must be a valid IPv6 address.";
}

[ValidationRule]
internal sealed partial class MacAddress : Rule {
    [GeneratedRegex(@"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) =>
        value.IsString(out var s) && Pattern().IsMatch(s)
            ? null
            : $"The {value.Field} field must be a valid MAC address.";
}

[ValidationRule]
internal sealed class Json : Rule {
    public override string? Check(in Value value) {
        if (!value.IsString(out var s))
            return $"The {value.Field} field must be a valid JSON string.";
        try {
            using var document = JsonDocument.Parse(s);
            return null;
        } catch (JsonException) {
            return $"The {value.Field} field must be a valid JSON string.";
        }
    }
}

[ValidationRule]
internal sealed partial class HexColor : Rule {
    [GeneratedRegex(@"^#(?:(?:[0-9a-fA-F]{3}){1,2}|(?:[0-9a-fA-F]{4}){1,2})$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) =>
        value.IsString(out var s) && Pattern().IsMatch(s)
            ? null
            : $"The {value.Field} field must be a valid hexadecimal color.";
}

[ValidationRule]
internal sealed class Timezone : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s) && TimeZoneInfo.TryFindSystemTimeZoneById(s, out _)
            ? null
            : $"The {value.Field} field must be a valid timezone.";
}

[ValidationRule]
internal sealed class DateFormat : Rule {
    public override string? Check(in Value value) =>
        value.IsString(out var s)
        && DateTime.TryParseExact(s, value.Text(0), CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            ? null
            : $"The {value.Field} field must match the format {value.Text(0)}.";
}

[ValidationRule]
internal sealed partial class Decimal : Rule {
    [GeneratedRegex(@"^[+-]?\d*\.?(\d*)$")]
    private static partial Regex Pattern();

    public override string? Check(in Value value) {
        if (!value.IsNumeric(out _))
            return Message(value);

        var match = Pattern().Match(value.Str());
        if (!match.Success)
            return Message(value);

        var decimals = match.Groups[1].Value.Length;
        var ok = value.Args.Length == 1
            ? decimals == (int)value.Number(0)
            : decimals >= (int)value.Number(0) && decimals <= (int)value.Number(1);
        return ok ? null : Message(value);
    }

    private static string Message(in Value value) =>
        $"The {value.Field} field must have {value.Text(0)} decimal places.";
}
