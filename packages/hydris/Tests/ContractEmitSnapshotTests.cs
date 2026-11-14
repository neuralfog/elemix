using System.Runtime.CompilerServices;
using Hydris.Build;

namespace Hydris.Tests;

public sealed class ContractEmitSnapshotTests {
    private const string Fixture = """
        namespace Snap;

        [Contract]
        public sealed partial record Echo(string Value);

        [Contract]
        public sealed partial record CreateReq(string Name, int Age);

        [Contract]
        public sealed partial record UpdateReq(string Name);

        [Handler]
        public sealed class SnapActions {
            [Get("/api/echo/:id")]
            [Action]
            public Reply GetById(string id) => Reply.Action<Echo>(new(id));

            [Get("/api/search")]
            [Action]
            public Reply Search(string? q, int page) => Reply.Action<Echo>(new(q));

            [Post("/api/items")]
            [Action]
            public Reply Create(CreateReq input) => Reply.Action<Echo>(new(input.Name));

            [Put("/api/items/:id")]
            [Action]
            public Reply Update(string id, UpdateReq input) => Reply.Action<Echo>(new(id));

            [Patch("/api/items/:id")]
            [Action]
            public Reply Patch(string id, UpdateReq input) => Reply.Action<Echo>(new(id));

            [Delete("/api/items/:id")]
            [Action]
            public Reply Remove(string id) => Reply.Action<Echo>(new(id));

            [Get("/api/hostile'`${alert(1)}//x")]
            [Action]
            public Reply Hostile() => Reply.Action<Echo>(new("x"));

            [Get("/api/`${bad}`/seg/:id")]
            [Action]
            public Reply HostileParam(string id) => Reply.Action<Echo>(new(id));

            [Post("/api/p'`st/:id")]
            [Action]
            public Reply HostilePost(string id, CreateReq input) => Reply.Action<Echo>(new(id));
        }
        """;

    [Fact]
    public void EmittedActionClientsMatchSnapshots() {
        var temp = Directory.CreateTempSubdirectory("hydris-contract-snap");
        try {
            File.WriteAllText(Path.Combine(temp.FullName, "Contracts.cs"), Fixture);
            ContractEmit.Run(temp.FullName, temp.FullName);

            var actions = Path.Combine(temp.FullName, "Views", "actions");
            var files = Directory
                .EnumerateFiles(actions, "*.ts")
                .OrderBy(p => p, StringComparer.Ordinal);
            foreach (var ts in files)
                MatchSnapshot(
                    "contract_" + Path.GetFileNameWithoutExtension(ts),
                    File.ReadAllText(ts));
        } finally {
            temp.Delete(true);
        }
    }

    private static void MatchSnapshot(
        string name, string actual, [CallerFilePath] string file = "") {
        var dir = Path.Combine(Path.GetDirectoryName(file)!, "snapshots");
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, name + ".snap");
        if (Environment.GetEnvironmentVariable("BLESS") == "1" || !File.Exists(path)) {
            File.WriteAllText(path, actual);
            return;
        }
        Assert.Equal(File.ReadAllText(path), actual);
    }
}
