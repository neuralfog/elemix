using System.Text;
using Hydris.Contracts;
using Xunit;

namespace Hydris.Tests;

[Contract]
public sealed partial record Presence(string Name, int Count, string? Note, int? Rank);

public sealed class ContractPresenceTests {
    private static (Presence? Value, string Json, bool Failed) Parse(string json) {
        var errors = new ContractValidation();
        var value = Presence.Parse(Encoding.UTF8.GetBytes(json), errors);
        var body = errors.Failed ? Encoding.UTF8.GetString(errors.ToReply().Content) : string.Empty;
        return (value, body, errors.Failed);
    }

    [Fact]
    public void OptionalMembersMayBeOmitted() {
        var (value, _, failed) = Parse("{\"name\":\"ada\",\"count\":3}");

        Assert.False(failed);
        Assert.NotNull(value);
        Assert.Null(value!.Note);
        Assert.Null(value.Rank);
    }

    [Fact]
    public void OptionalMembersAcceptExplicitNull() {
        var (_, _, failed) = Parse("{\"name\":\"ada\",\"count\":3,\"note\":null,\"rank\":null}");

        Assert.False(failed);
    }

    [Fact]
    public void MissingRequiredValueTypeReportsRequired() {
        var (_, json, failed) = Parse("{\"name\":\"ada\"}");

        Assert.True(failed);
        Assert.Contains("\"field\":\"count\"", json);
        Assert.Contains("\"code\":\"required\"", json);
    }

    [Fact]
    public void MissingRequiredReferenceTypeReportsRequired() {
        var (_, json, failed) = Parse("{\"count\":3}");

        Assert.True(failed);
        Assert.Contains("\"field\":\"name\"", json);
        Assert.Contains("\"code\":\"required\"", json);
    }

    [Fact]
    public void ExplicitNullStringCoercesToEmptyAndIsPresent() {
        var (value, _, failed) = Parse("{\"name\":null,\"count\":3}");

        Assert.False(failed);
        Assert.NotNull(value);
        Assert.Equal(string.Empty, value!.Name);
    }

    [Fact]
    public void PresentRequiredMembersPass() {
        var (value, _, failed) = Parse("{\"name\":\"ada\",\"count\":3,\"note\":\"hi\",\"rank\":9}");

        Assert.False(failed);
        Assert.NotNull(value);
        Assert.Equal("ada", value!.Name);
        Assert.Equal(3, value.Count);
    }
}
