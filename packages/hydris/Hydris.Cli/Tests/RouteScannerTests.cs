using Hydris.Cli.Routing;

namespace Hydris.Cli.Tests;

public sealed class RouteScannerTests {
    [Fact]
    public void ScanReadsVerbPathAndHandler() {
        const string source = """
            public sealed class HomeController {
                [Get("/")]
                public Reply Index() => Reply.Text("hi");
            }
            """;

        var routes = RouteScanner.Scan(source);

        Assert.Single(routes);
        Assert.Equal("Get", routes[0].Method);
        Assert.Equal("/", routes[0].Path);
        Assert.Equal("HomeController", routes[0].Handler);
    }

    [Fact]
    public void ScanReadsEveryVerb() {
        const string source = """
            public sealed class ApiController {
                [Get("/a")] public Reply A() => default;
                [Post("/b")] public Reply B() => default;
                [Put("/c")] public Reply C() => default;
                [Patch("/d")] public Reply D() => default;
                [Delete("/e")] public Reply E() => default;
            }
            """;

        var routes = RouteScanner.Scan(source);

        Assert.Equal(5, routes.Count);
        Assert.Contains(routes, r => r is { Method: "Post", Path: "/b" });
        Assert.Contains(routes, r => r is { Method: "Delete", Path: "/e" });
    }

    [Fact]
    public void ScanHandlesNamespaceAndAttributeSuffix() {
        const string source = """
            public sealed class UserController {
                [Hydris.Routing.GetAttribute("/users/{id}")]
                public Reply Show() => default;
            }
            """;

        var routes = RouteScanner.Scan(source);

        Assert.Single(routes);
        Assert.Equal("Get", routes[0].Method);
        Assert.Equal("/users/{id}", routes[0].Path);
        Assert.Equal("UserController", routes[0].Handler);
    }

    [Fact]
    public void ScanAssignsRouteToNearestPrecedingClass() {
        const string source = """
            public sealed class First {
                [Get("/first")] public Reply A() => default;
            }

            public sealed class Second {
                [Post("/second")] public Reply B() => default;
            }
            """;

        var routes = RouteScanner.Scan(source);

        Assert.Equal("First", routes[0].Handler);
        Assert.Equal("Second", routes[1].Handler);
    }

    [Fact]
    public void FlagMarksSameMethodAndPathAsDuplicate() {
        IReadOnlyList<RouteInfo> routes = [
            new("Post", "/users", "UserController"),
            new("Post", "/users", "AdminController"),
            new("Get", "/users", "UserController"),
        ];

        var rows = RouteScanner.Flag(routes);

        Assert.True(rows[0].Duplicate);
        Assert.True(rows[1].Duplicate);
        Assert.False(rows[2].Duplicate);
    }

    [Fact]
    public void FlagLeavesDistinctRoutesUnique() {
        IReadOnlyList<RouteInfo> routes = [
            new("Get", "/a", "A"),
            new("Get", "/b", "B"),
            new("Post", "/a", "A"),
        ];

        var rows = RouteScanner.Flag(routes);

        Assert.All(rows, row => Assert.False(row.Duplicate));
    }

    [Fact]
    public void ScanDirectoryReadsSourcesAndSkipsBuildOutput() {
        var root = Directory.CreateTempSubdirectory("hcli-routes");
        try {
            File.WriteAllText(
                Path.Combine(root.FullName, "Home.cs"),
                "public sealed class Home { [Get(\"/\")] public Reply I() => default; }");

            var obj = Directory.CreateDirectory(Path.Combine(root.FullName, "obj")).FullName;
            File.WriteAllText(
                Path.Combine(obj, "Generated.cs"),
                "public sealed class Gen { [Get(\"/gen\")] public Reply G() => default; }");

            var routes = RouteScanner.ScanDirectory(root.FullName);

            Assert.Single(routes);
            Assert.Equal("/", routes[0].Path);
            Assert.Equal("Home", routes[0].Handler);
        } finally {
            root.Delete(true);
        }
    }
}
