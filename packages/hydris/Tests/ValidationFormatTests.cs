using Hydris.Validation;

namespace Hydris.Tests;

public sealed class FormatTests {
    private static bool Passes(string rule, object? value, params string[] args) =>
        Rules.Check(rule, new Value { Field = "x", Raw = value, Args = args }) is null;

    [Fact]
    public void Email() {
        Assert.True(Passes("email", "foo@example.com"));
        Assert.True(Passes("email", "a.b+c@sub.example.co.uk"));
        Assert.False(Passes("email", "invalid"));
        Assert.False(Passes("email", "foo@bar"));
        Assert.False(Passes("email", "foo @bar.com"));
    }

    [Fact]
    public void Url() {
        Assert.True(Passes("url", "https://example.com"));
        Assert.True(Passes("url", "http://example.com/path?q=1"));
        Assert.False(Passes("url", "notaurl"));
        Assert.False(Passes("url", "ftp://example.com"));
    }

    [Fact]
    public void Uuid() {
        Assert.True(Passes("uuid", "0193f2a1-66b8-70e7-856c-b446bb831d3e"));
        Assert.False(Passes("uuid", "not-a-uuid"));
        Assert.False(Passes("uuid", "0193f2a1-66b8-70e7-856c"));
    }

    [Fact]
    public void Ulid() {
        Assert.True(Passes("ulid", "01ARZ3NDEKTSV4RRFFQ69G5FAV"));
        Assert.False(Passes("ulid", "short"));
        Assert.False(Passes("ulid", "01ARZ3NDEKTSV4RRFFQ69G5FA"));
    }

    [Fact]
    public void Ip() {
        Assert.True(Passes("ip", "127.0.0.1"));
        Assert.True(Passes("ip", "::1"));
        Assert.False(Passes("ip", "999.1.1.1"));
        Assert.True(Passes("ipv4", "192.168.0.1"));
        Assert.False(Passes("ipv4", "::1"));
        Assert.True(Passes("ipv6", "2001:db8::1"));
        Assert.False(Passes("ipv6", "127.0.0.1"));
    }

    [Fact]
    public void MacAddress() {
        Assert.True(Passes("mac_address", "01:23:45:67:89:ab"));
        Assert.True(Passes("mac_address", "01-23-45-67-89-AB"));
        Assert.False(Passes("mac_address", "0123.4567.89ab"));
    }

    [Fact]
    public void Json() {
        Assert.True(Passes("json", "{\"a\":1}"));
        Assert.True(Passes("json", "[1,2,3]"));
        Assert.False(Passes("json", "{bad"));
        Assert.False(Passes("json", "notjson"));
    }

    [Fact]
    public void HexColor() {
        Assert.True(Passes("hex_color", "#fff"));
        Assert.True(Passes("hex_color", "#ffffff"));
        Assert.True(Passes("hex_color", "#FF00FF80"));
        Assert.False(Passes("hex_color", "#ggg"));
        Assert.False(Passes("hex_color", "ffffff"));
    }

    [Fact]
    public void Timezone() {
        Assert.True(Passes("timezone", "UTC"));
        Assert.True(Passes("timezone", "Europe/London"));
        Assert.False(Passes("timezone", "Nope/Nowhere"));
    }

    [Fact]
    public void DateFormat() {
        Assert.True(Passes("date_format", "2024-01-15", "yyyy-MM-dd"));
        Assert.False(Passes("date_format", "15/01/2024", "yyyy-MM-dd"));
        Assert.False(Passes("date_format", "2024-13-99", "yyyy-MM-dd"));
    }

    [Fact]
    public void Decimal() {
        Assert.True(Passes("decimal", "0.75", "2"));
        Assert.False(Passes("decimal", "0.7", "2"));
        Assert.True(Passes("decimal", "0.75", "1", "3"));
        Assert.False(Passes("decimal", "0.7555", "1", "3"));
        Assert.False(Passes("decimal", "abc", "2"));
    }
}
