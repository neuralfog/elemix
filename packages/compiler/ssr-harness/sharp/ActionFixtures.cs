using Hydris.Container;
using Hydris.Contracts;
using Hydris.Http;
using Hydris.Routing;
using Hydris.Validation;

namespace Hydris.Harness;

[ValidationRule]
internal sealed class Slug : Rule {
    public override string? Check(in Value value) {
        if (!value.IsString(out var text))
            return null;

        foreach (var character in text) {
            if (!char.IsAsciiLetterLower(character) && !char.IsAsciiDigit(character) && character != '-')
                return $"The {value.Field} field must be a lowercase slug.";
        }

        return null;
    }
}

[Contract]
public sealed partial record CreateUserRequest(
    [Required][Between(2, 40)] string Name,
    [Required][Email] string Email,
    [Required][Rule<Slug>] string Handle,
    [Between(18, 120)] int Age);

[Contract]
public sealed partial record UserResponse(string Id, string Name, string Handle);

[Contract]
public sealed partial record EchoResult(string Value, int Page);

[Handler]
public sealed class ActionFixtures {
    [Post("/api/users")]
    [Action]
    public ActionResult<UserResponse> CreateUser(CreateUserRequest input) =>
        ActionResult.Of(new UserResponse("u1", input.Name, input.Handle))
            .Status(201)
            .Header("Location", "/api/users/u1");

    [Get("/api/users/:id")]
    [Action]
    public UserResponse GetUser(string id) => new(id, "User " + id, "user-" + id);

    [Put("/api/users/:id")]
    [Action]
    public UserResponse UpdateUser(string id, CreateUserRequest input) =>
        new(id, input.Name, input.Handle);

    [Delete("/api/users/:id")]
    [Action]
    public UserResponse DeleteUser(string id) => new(id, "deleted", "deleted");

    [Get("/api/echo")]
    [Action]
    public async Task<EchoResult> Echo(string? value, int page, int delay) {
        if (delay > 0)
            await Task.Delay(delay);
        return new EchoResult(value ?? "none", page);
    }

    [Get("/api/conflict")]
    [Action]
    public ActionResult<UserResponse> Conflict() =>
        ActionResult.Of(new UserResponse("x", "x", "x")).Status(409);
}
