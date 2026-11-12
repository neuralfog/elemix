namespace Hydris.Validation;

public abstract class Rule {
    public abstract string? Check(in Value value);
}
