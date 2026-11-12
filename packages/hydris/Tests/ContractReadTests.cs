using System;
using System.Buffers;
using System.Text.Json;
using Hydris.Contracts;
using Hydris.Http;
using Xunit;

namespace Hydris.Tests;

public enum Flavor {
    Sweet,
    Salty,
    Sour,
}

[Contract]
public sealed partial record Leaf(string Name, int Size, Flavor Flavor, DateTime When);

[Contract]
public sealed partial record Tree(
    string Title,
    Flavor Mood,
    DateTime Stamp,
    Leaf Root,
    Leaf[] Leaves,
    int? Rank);

public sealed class ContractReadTests {
    [Fact]
    public void ComplexContractRoundTripsThroughWriteAndParse() {
        var tree = new Tree(
            "Oak",
            Flavor.Salty,
            new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc),
            new Leaf("root", 9, Flavor.Sweet, new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc)),
            [
                new Leaf("a", 1, Flavor.Sour, new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)),
                new Leaf("b", 2, Flavor.Sweet, new DateTime(2024, 2, 2, 0, 0, 0, DateTimeKind.Utc)),
            ],
            null);

        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
            ((IViewData)tree).Write(writer);

        var errors = new ContractValidation();
        var parsed = Tree.Parse(buffer.WrittenSpan, errors);

        Assert.NotNull(parsed);
        Assert.False(errors.Failed);
        Assert.Equal("Oak", parsed!.Title);
        Assert.Equal(Flavor.Salty, parsed.Mood);
        Assert.Equal(tree.Stamp, parsed.Stamp);
        Assert.Equal("root", parsed.Root.Name);
        Assert.Equal(Flavor.Sweet, parsed.Root.Flavor);
        Assert.Equal(tree.Root.When, parsed.Root.When);
        Assert.Equal(2, parsed.Leaves.Length);
        Assert.Equal("a", parsed.Leaves[0].Name);
        Assert.Equal(Flavor.Sour, parsed.Leaves[0].Flavor);
        Assert.Equal(Flavor.Sweet, parsed.Leaves[1].Flavor);
        Assert.Equal(2, parsed.Leaves[1].Size);
        Assert.Null(parsed.Rank);
    }

    [Fact]
    public void NullablePresentValueParses() {
        var tree = new Tree(
            "Elm",
            Flavor.Sour,
            new DateTime(2026, 3, 3, 0, 0, 0, DateTimeKind.Utc),
            new Leaf("r", 0, Flavor.Salty, new DateTime(2026, 3, 3, 0, 0, 0, DateTimeKind.Utc)),
            [],
            42);

        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
            ((IViewData)tree).Write(writer);

        var parsed = Tree.Parse(buffer.WrittenSpan, new ContractValidation());

        Assert.NotNull(parsed);
        Assert.Equal(42, parsed!.Rank);
        Assert.Empty(parsed.Leaves);
    }
}
