using System.Collections;
using System.Globalization;

namespace Hydris.Validation;

public readonly ref struct Value {
    public required string Field { get; init; }
    public required object? Raw { get; init; }
    public ReadOnlySpan<string> Args { get; init; }

    public bool IsNull => Raw is null;

    public bool IsString(out string text) {
        if (Raw is string s) {
            text = s;
            return true;
        }
        text = string.Empty;
        return false;
    }

    public bool IsEmpty => Raw switch {
        null => true,
        string s => s.Length == 0,
        ICollection c => c.Count == 0,
        _ => false,
    };

    public double Size() => Raw switch {
        string s => s.Length,
        byte b => b,
        sbyte sb => sb,
        short sh => sh,
        ushort us => us,
        int i => i,
        uint ui => ui,
        long l => l,
        ulong ul => ul,
        float f => f,
        double d => d,
        decimal m => (double)m,
        ICollection c => c.Count,
        _ => 0,
    };

    public bool IsNumeric(out double number) {
        switch (Raw) {
            case byte or sbyte or short or ushort or int or uint or long or ulong or float or double or decimal:
                number = Convert.ToDouble(Raw, CultureInfo.InvariantCulture);
                return true;
            case string s when double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out number):
                return true;
            default:
                number = 0;
                return false;
        }
    }

    public string Str() => Raw as string ?? Raw?.ToString() ?? string.Empty;

    public double Number(int arg) => double.Parse(Args[arg], CultureInfo.InvariantCulture);

    public string Text(int arg) => Args[arg];
}
