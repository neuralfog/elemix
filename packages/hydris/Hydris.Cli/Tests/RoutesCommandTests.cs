namespace Hydris.Cli.Tests;

public sealed class RoutesCommandTests {
    [Fact]
    public void ReturnsZeroWhenEveryRouteIsUnique() {
        var root = Directory.CreateTempSubdirectory("hcli-routes-ok");
        try {
            File.WriteAllText(
                Path.Combine(root.FullName, "Handlers.cs"),
                """
                public sealed class Home { [Get("/")] public Reply A() => default; }
                public sealed class Users { [Post("/users")] public Reply B() => default; }
                """);

            var (code, output) = Capture(() => RoutesCommand.Run(root.FullName));

            Assert.Equal(0, code);
            Assert.Contains("/users", output);
            Assert.Contains("Users", output);
        } finally {
            root.Delete(true);
        }
    }

    [Fact]
    public void ReturnsOneWhenARouteIsDuplicated() {
        var root = Directory.CreateTempSubdirectory("hcli-routes-dup");
        try {
            File.WriteAllText(
                Path.Combine(root.FullName, "Handlers.cs"),
                """
                public sealed class One { [Post("/users")] public Reply A() => default; }
                public sealed class Two { [Post("/users")] public Reply B() => default; }
                """);

            var (code, _) = Capture(() => RoutesCommand.Run(root.FullName));

            Assert.Equal(1, code);
        } finally {
            root.Delete(true);
        }
    }

    [Fact]
    public void ReturnsZeroWhenThereAreNoRoutes() {
        var root = Directory.CreateTempSubdirectory("hcli-routes-empty");
        try {
            File.WriteAllText(Path.Combine(root.FullName, "Plain.cs"), "public sealed class Plain { }");

            var (code, _) = Capture(() => RoutesCommand.Run(root.FullName));

            Assert.Equal(0, code);
        } finally {
            root.Delete(true);
        }
    }

    private static (int Code, string Output) Capture(Func<int> action) {
        var original = Console.Out;
        var buffer = new StringWriter();
        Console.SetOut(buffer);
        try {
            var code = action();
            return (code, buffer.ToString());
        } finally {
            Console.SetOut(original);
        }
    }
}
