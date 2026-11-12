using Hydris.Validation;

namespace Hydris.Tests;

public sealed class RuleTests {
    private static bool Passes(string rule, object? value, params string[] args) =>
        Rules.Check(rule, new Value { Field = "x", Raw = value, Args = args }) is null;

    [Fact]
    public void Required() {
        Assert.False(Passes("required", null));
        Assert.False(Passes("required", ""));
        Assert.False(Passes("required", "   "));
        Assert.True(Passes("required", "foo"));
        Assert.False(Passes("required", new string[0]));
        Assert.True(Passes("required", new[] { "a" }));
    }

    [Fact]
    public void Filled() {
        Assert.True(Passes("filled", null));
        Assert.False(Passes("filled", ""));
        Assert.False(Passes("filled", "  "));
        Assert.True(Passes("filled", "foo"));
    }

    [Fact]
    public void Alpha() {
        Assert.True(Passes("alpha", "aslsdlks"));
        Assert.False(Passes("alpha", "http://google.com"));
        Assert.True(Passes("alpha", "ユニコードを基盤技術と"));
        Assert.False(Passes("alpha", "ユニコード を基盤技術と"));
        Assert.True(Passes("alpha", "नमस्कार"));
        Assert.False(Passes("alpha", "आपका स्वागत है"));
        Assert.True(Passes("alpha", "Continuación"));
        Assert.False(Passes("alpha", "ofreció su dimisión"));
        Assert.False(Passes("alpha", 123));
        Assert.True(Passes("alpha", "abc", "ascii"));
        Assert.False(Passes("alpha", "ユニコード", "ascii"));
    }

    [Fact]
    public void AlphaNum() {
        Assert.True(Passes("alpha_num", "asls13dlks"));
        Assert.False(Passes("alpha_num", "http://g232oogle.com"));
        Assert.True(Passes("alpha_num", "ユニコード12"));
        Assert.False(Passes("alpha_num", "ユニ コード12"));
    }

    [Fact]
    public void AlphaDash() {
        Assert.True(Passes("alpha_dash", "asls1-_3dlks"));
        Assert.False(Passes("alpha_dash", "http://-g232oogle.com"));
        Assert.True(Passes("alpha_dash", "नमस्कार-_"));
    }

    [Fact]
    public void Ascii() {
        Assert.True(Passes("ascii", "abc-123_!"));
        Assert.False(Passes("ascii", "ユニコード"));
        Assert.False(Passes("ascii", "Café"));
    }

    [Fact]
    public void Lowercase() {
        Assert.True(Passes("lowercase", "hello"));
        Assert.False(Passes("lowercase", "Hello"));
        Assert.True(Passes("lowercase", "hello world 123"));
    }

    [Fact]
    public void Uppercase() {
        Assert.True(Passes("uppercase", "HELLO"));
        Assert.False(Passes("uppercase", "Hello"));
    }

    [Fact]
    public void Min() {
        Assert.False(Passes("min", "a", "3"));
        Assert.True(Passes("min", "abc", "3"));
        Assert.True(Passes("min", "abcd", "3"));
        Assert.False(Passes("min", 2, "3"));
        Assert.True(Passes("min", 3, "3"));
    }

    [Fact]
    public void Max() {
        Assert.True(Passes("max", "abc", "3"));
        Assert.False(Passes("max", "abcd", "3"));
        Assert.True(Passes("max", 3, "3"));
        Assert.False(Passes("max", 4, "3"));
    }

    [Fact]
    public void Between() {
        Assert.False(Passes("between", "asdad", "3", "4"));
        Assert.True(Passes("between", "anc", "3", "5"));
        Assert.True(Passes("between", "ancfs", "3", "5"));
        Assert.False(Passes("between", 123, "50", "100"));
        Assert.True(Passes("between", 123, "123", "200"));
        Assert.True(Passes("between", 123, "0", "123"));
        Assert.True(Passes("between", 0.02, "0.01", "0.02"));
    }

    [Fact]
    public void Size() {
        Assert.False(Passes("size", "asdad", "3"));
        Assert.True(Passes("size", "anc", "3"));
        Assert.False(Passes("size", 123, "3"));
        Assert.True(Passes("size", 3, "3"));
    }
}
