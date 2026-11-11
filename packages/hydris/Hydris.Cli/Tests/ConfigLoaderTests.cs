using Hydris.Cli.Config;

namespace Hydris.Cli.Tests;

public sealed class ConfigLoaderTests {
    [Fact]
    public void ParsesTasksEnvAndFields() {
        var yaml = """
            env:
              NODE_ENV: development
            tasks:
              build:
                desc: Build
                run: dotnet build
              ci:
                shell: bash
                cwd: ./src
                env:
                  X: "1"
                run: [clean, build, "dotnet test"]
            """;
        var file = ConfigLoader.Parse(yaml);

        Assert.Equal("development", file.Env["NODE_ENV"]);
        Assert.Equal(new[] { "dotnet build" }, file.Tasks["build"].Run.Items);
        Assert.Equal("Build", file.Tasks["build"].Desc);
        Assert.Equal(new[] { "clean", "build", "dotnet test" }, file.Tasks["ci"].Run.Items);
        Assert.Equal("bash", file.Tasks["ci"].Shell);
        Assert.Equal("./src", file.Tasks["ci"].Cwd);
        Assert.Equal("1", file.Tasks["ci"].Env["X"]);
    }

    [Fact]
    public void RunScalarBecomesSingleItem() {
        var yaml = "tasks:\n  a:\n    run: echo hi";
        var file = ConfigLoader.Parse(yaml);
        Assert.Equal(new[] { "echo hi" }, file.Tasks["a"].Run.Items);
    }

    [Fact]
    public void ParsesMultilineBlockScalar() {
        var yaml = "tasks:\n  a:\n    run: |\n      echo one\n      echo two\n";
        var file = ConfigLoader.Parse(yaml);
        Assert.Single(file.Tasks["a"].Run.Items);
        Assert.Contains("echo one", file.Tasks["a"].Run.Items[0]);
        Assert.Contains("echo two", file.Tasks["a"].Run.Items[0]);
    }

    [Fact]
    public void EmptyFieldsDefaultToEmpty() {
        var file = ConfigLoader.Parse("tasks:\n  a:\n    run: echo");
        Assert.Single(file.Tasks);
        Assert.Empty(file.Env);
        Assert.True(file.Tasks["a"].Parallel.IsEmpty);
    }

    [Fact]
    public void FindWalksUpToAParent() {
        var root = Directory.CreateTempSubdirectory("hcli-find");
        try {
            File.WriteAllText(Path.Combine(root.FullName, "hydris.yml"), "tasks:\n  a:\n    run: echo");
            var sub = Directory.CreateDirectory(Path.Combine(root.FullName, "a", "b"));
            var loaded = ConfigLoader.Find(sub.FullName);
            Assert.NotNull(loaded);
            Assert.True(loaded!.File.Tasks.ContainsKey("a"));
        } finally {
            root.Delete(true);
        }
    }
}
