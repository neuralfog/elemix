using Hydris.Validation;

namespace Hydris.Tests;

[ValidationRule("pin\"quote\\slash")]
public sealed class PinEscapeRule : Rule {
    public override string? Check(in Value value) => null;
}

public sealed class ValidationRuleEscapeTests {
    [Fact]
    public void RuleNameWithQuoteAndBackslashIsEscapedAndRegistered() {
        Assert.NotNull(Rules.Resolve("pin\"quote\\slash"));
    }
}
