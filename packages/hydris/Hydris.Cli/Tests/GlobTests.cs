using Hydris.Cli;

namespace Hydris.Cli.Tests;

public sealed class GlobTests {
    [Theory]
    [InlineData("**/*.ts", "Views/Foo.ts", true)]
    [InlineData("**/*.ts", "a/b/c/Foo.ts", true)]
    [InlineData("**/*.ts", "Foo.ts", true)]
    [InlineData("**/*.ts", "Foo.cs", false)]
    [InlineData("**/*.ts", "Foo.tsx", false)]
    [InlineData("*.ts", "Foo.ts", true)]
    [InlineData("*.ts", "Views/Foo.ts", false)]
    [InlineData("**/*.cs", "Program.cs", true)]
    [InlineData("**/*.cs", "Handlers/X.cs", true)]
    [InlineData("Views/**/*.ts", "Views/Pages/Home.ts", true)]
    [InlineData("Views/**/*.ts", "Views/Home.ts", true)]
    [InlineData("Views/**/*.ts", "Other/Home.ts", false)]
    [InlineData("?.ts", "a.ts", true)]
    [InlineData("?.ts", "ab.ts", false)]
    public void MatchesExpected(string pattern, string path, bool expected) {
        Assert.Equal(expected, Glob.Compile(pattern).IsMatch(path));
    }

    [Fact]
    public void BackslashesAreNormalised() {
        Assert.True(Glob.Compile("**/*.ts").IsMatch("Views\\Foo.ts"));
    }

    [Fact]
    public void LeadingDotSlashIsStripped() {
        Assert.True(Glob.Compile("./**/*.ts").IsMatch("Views/Foo.ts"));
    }

    [Fact]
    public void BaseDirIsTheLiteralPrefix() {
        Assert.Equal("Views", Glob.Compile("Views/**/*.ts").BaseDir);
        Assert.Equal(".", Glob.Compile("**/*.ts").BaseDir);
        Assert.Equal(".", Glob.Compile("*.ts").BaseDir);
    }
}
