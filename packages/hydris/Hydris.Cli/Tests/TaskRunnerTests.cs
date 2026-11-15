using Hydris.Cli.Config;
using Hydris.Cli.Tasks;

namespace Hydris.Cli.Tests;

public sealed class TaskRunnerTests {
    private static LoadedConfig Config(string yaml) =>
        new() { File = ConfigLoader.Parse(yaml), Path = "hydris.yml", RootDir = "." };

    private static int Run(string yaml, string task) =>
        TaskRunner.Run(Config(yaml), task, new Dictionary<string, string>());

    private static int RunIn(string root, string yaml, string task, Dictionary<string, string>? cliEnv = null) =>
        TaskRunner.Run(
            new LoadedConfig { File = ConfigLoader.Parse(yaml), Path = Path.Combine(root, "hydris.yml"), RootDir = root },
            task,
            cliEnv ?? new Dictionary<string, string>());

    [Fact]
    public void DotEnvValueReachesTheTask() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, ".env"), "GREETING=hello\n");
            Assert.Equal(0, RunIn(dir, "tasks:\n  check:\n    run: test \"$GREETING\" = hello", "check"));
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void HydrisYmlEnvOverridesDotEnv() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, ".env"), "GREETING=fromdotenv\n");
            var yaml = "env:\n  GREETING: fromyaml\ntasks:\n  check:\n    run: test \"$GREETING\" = fromyaml";
            Assert.Equal(0, RunIn(dir, yaml, "check"));
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void CliEnvOverridesDotEnv() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, ".env"), "GREETING=fromdotenv\n");
            Assert.Equal(0, RunIn(dir, "tasks:\n  check:\n    run: test \"$GREETING\" = fromcli", "check",
                new Dictionary<string, string> { ["GREETING"] = "fromcli" }));
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void RunExecutesAScalarCommand() {
        Assert.Equal(0, Run("tasks:\n  a: { run: \"exit 0\" }", "a"));
    }

    [Fact]
    public void RunReportsUnknownTask() {
        Assert.NotEqual(0, Run("tasks:\n  a: { run: echo a }", "missing"));
    }

    [Fact]
    public void RunSeriesStopsOnFirstFailure() {
        var code = Run("""
            tasks:
              a: { run: ["exit 0", "exit 4", "exit 0"] }
            """, "a");
        Assert.Equal(4, code);
    }

    [Fact]
    public void RunSeriesRunsReferencedTasksInOrder() {
        var code = Run("""
            tasks:
              clean: { run: "exit 0" }
              build: { run: "exit 0" }
              ci: { run: [clean, build, "exit 0"] }
            """, "ci");
        Assert.Equal(0, code);
    }

    [Fact]
    public void RunSeriesPropagatesAReferencedTaskFailure() {
        var code = Run("""
            tasks:
              ok: { run: "exit 0" }
              bad: { run: "exit 5" }
              ci: { run: [ok, bad] }
            """, "ci");
        Assert.Equal(5, code);
    }

    [Fact]
    public void RunDetectsCyclicTaskReferences() {
        var code = Run("""
            tasks:
              a: { run: [b] }
              b: { run: [a] }
            """, "a");
        Assert.NotEqual(0, code);
    }

    [Fact]
    public void ParallelGroupSucceedsWhenAllMembersPass() {
        var code = Run("""
            tasks:
              a: { run: "exit 0" }
              b: { run: "exit 0" }
              all: { parallel: [a, b] }
            """, "all");
        Assert.Equal(0, code);
    }

    [Fact]
    public void ParallelGroupFailsWithAMemberExitCode() {
        var code = Run("""
            tasks:
              ok: { run: "exit 0" }
              bad: { run: "exit 3" }
              all: { parallel: [ok, bad] }
            """, "all");
        Assert.Equal(3, code);
    }

    [Fact]
    public void ParallelRunsARawCommandMember() {
        Assert.Equal(0, Run("tasks:\n  all: { parallel: [\"exit 0\"] }", "all"));
    }

    [Fact]
    public void ParallelRejectsAMultiStepTaskMember() {
        var code = Run("""
            tasks:
              multi: { run: ["exit 0", "exit 0"] }
              all: { parallel: [multi] }
            """, "all");
        Assert.NotEqual(0, code);
    }

    [Fact]
    public void ParallelRejectsAParallelTaskMember() {
        var code = Run("""
            tasks:
              a: { run: "exit 0" }
              inner: { parallel: [a] }
              all: { parallel: [inner] }
            """, "all");
        Assert.NotEqual(0, code);
    }
}
