using Hydris.Validation;

namespace Hydris.Tests;

public sealed class ContentTypeTests {
    private static bool Passes(string rule, object? value, params string[] args) =>
        Rules.Check(rule, new Value { Field = "x", Raw = value, Args = args }) is null;

    [Fact]
    public void In() {
        Assert.True(Passes("in", "a", "a", "b", "c"));
        Assert.False(Passes("in", "z", "a", "b", "c"));
        Assert.True(Passes("in", 2, "1", "2", "3"));
    }

    [Fact]
    public void NotIn() {
        Assert.True(Passes("not_in", "z", "a", "b", "c"));
        Assert.False(Passes("not_in", "a", "a", "b", "c"));
    }

    [Fact]
    public void StartsEndsWith() {
        Assert.True(Passes("starts_with", "hello", "he", "wo"));
        Assert.False(Passes("starts_with", "xello", "he", "wo"));
        Assert.True(Passes("ends_with", "hello", "lo"));
        Assert.False(Passes("ends_with", "help", "lo"));
        Assert.True(Passes("doesnt_start_with", "hello", "wo"));
        Assert.False(Passes("doesnt_start_with", "hello", "he"));
        Assert.True(Passes("doesnt_end_with", "hello", "p"));
        Assert.False(Passes("doesnt_end_with", "hello", "lo"));
    }

    [Fact]
    public void Regex() {
        Assert.True(Passes("regex", "abc123", "^[a-z]+[0-9]+$"));
        Assert.False(Passes("regex", "123abc", "^[a-z]+[0-9]+$"));
        Assert.True(Passes("not_regex", "abc", "^[0-9]+$"));
        Assert.False(Passes("not_regex", "123", "^[0-9]+$"));
    }

    [Fact]
    public void Boolean() {
        Assert.True(Passes("boolean", true));
        Assert.True(Passes("boolean", false));
        Assert.True(Passes("boolean", 0));
        Assert.True(Passes("boolean", 1));
        Assert.True(Passes("boolean", "0"));
        Assert.True(Passes("boolean", "1"));
        Assert.False(Passes("boolean", "true"));
        Assert.False(Passes("boolean", 2));
        Assert.False(Passes("boolean", "yes"));
    }

    [Fact]
    public void Integer() {
        Assert.True(Passes("integer", 5));
        Assert.True(Passes("integer", "5"));
        Assert.True(Passes("integer", "-5"));
        Assert.False(Passes("integer", "5.0"));
        Assert.False(Passes("integer", "abc"));
        Assert.False(Passes("integer", 5.5));
    }

    [Fact]
    public void Numeric() {
        Assert.True(Passes("numeric", 5));
        Assert.True(Passes("numeric", 5.5));
        Assert.True(Passes("numeric", "5.5"));
        Assert.True(Passes("numeric", "-3"));
        Assert.False(Passes("numeric", "abc"));
        Assert.False(Passes("numeric", true));
    }

    [Fact]
    public void StringRule() {
        Assert.True(Passes("string", "x"));
        Assert.False(Passes("string", 5));
        Assert.False(Passes("string", null));
    }

    [Fact]
    public void Digits() {
        Assert.True(Passes("digits", "12345", "5"));
        Assert.False(Passes("digits", "123", "5"));
        Assert.False(Passes("digits", "12a45", "5"));
        Assert.True(Passes("digits", 12345, "5"));
    }

    [Fact]
    public void DigitsBetween() {
        Assert.True(Passes("digits_between", "12345", "3", "6"));
        Assert.False(Passes("digits_between", "12", "3", "6"));
        Assert.False(Passes("digits_between", "1234567", "3", "6"));
    }

    [Fact]
    public void MinMaxDigits() {
        Assert.True(Passes("min_digits", "12345", "3"));
        Assert.False(Passes("min_digits", "12", "3"));
        Assert.True(Passes("max_digits", "123", "5"));
        Assert.False(Passes("max_digits", "123456", "5"));
    }

    [Fact]
    public void MultipleOf() {
        Assert.True(Passes("multiple_of", 10, "5"));
        Assert.False(Passes("multiple_of", 7, "5"));
        Assert.True(Passes("multiple_of", 0.4, "0.2"));
        Assert.False(Passes("multiple_of", "abc", "5"));
    }
}
