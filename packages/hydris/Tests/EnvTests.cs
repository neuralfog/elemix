using Hydris;

namespace Hydris.Tests;

[CollectionDefinition("Env", DisableParallelization = true)]
public sealed class EnvCollection;

[Collection("Env")]
public sealed class EnvTests : IDisposable {
    private const string Prefix = "HYDRIS_TEST_";
    private readonly List<string> Touched = [];

    private static string N(string suffix) => Prefix + suffix;

    private void Set(string suffix, string value) {
        var name = N(suffix);
        Touched.Add(name);
        Environment.SetEnvironmentVariable(name, value);
    }

    public void Dispose() {
        foreach (var name in Touched)
            Environment.SetEnvironmentVariable(name, null);
    }

    private string TempEnv(string contents) {
        var path = Path.Combine(Path.GetTempPath(), Prefix + Guid.NewGuid().ToString("N") + ".env");
        File.WriteAllText(path, contents);
        return path;
    }

    private string? ParseRaw(string fullKey, string line) {
        Touched.Add(fullKey);
        var path = TempEnv(line);
        try {
            Env.Overload(path);
            return Environment.GetEnvironmentVariable(fullKey);
        } finally {
            File.Delete(path);
        }
    }

    [Fact]
    public void HasReflectsPresence() {
        Set("HAS", "x");
        Assert.True(Env.Has(N("HAS")));
        Assert.False(Env.Has(N("ABSENT")));
    }

    [Fact]
    public void EmptyCountsAsUnset() {
        Set("EMPTY", "");
        Assert.False(Env.Has(N("EMPTY")));
        Assert.Equal("fallback", Env.Get(N("EMPTY"), "fallback"));
        Assert.Throws<EnvException>(() => Env.Get(N("EMPTY")));
    }

    [Fact]
    public void TryGetReportsPresence() {
        Set("TG", "value");
        Assert.True(Env.TryGet(N("TG"), out var found));
        Assert.Equal("value", found);
        Assert.False(Env.TryGet(N("ABSENT"), out var missing));
        Assert.Null(missing);
    }

    [Fact]
    public void GetThrowsWhenMissing() {
        var ex = Assert.Throws<EnvException>(() => Env.Get(N("ABSENT")));
        Assert.Contains(N("ABSENT"), ex.Message);
    }

    [Fact]
    public void GetReturnsValueAndFallback() {
        Set("G", "real");
        Assert.Equal("real", Env.Get(N("G")));
        Assert.Equal("real", Env.Get(N("G"), "fb"));
        Assert.Equal("fb", Env.Get(N("ABSENT"), "fb"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void BlankNameThrowsArgumentException(string? name) {
        Assert.ThrowsAny<ArgumentException>(() => Env.Get(name!));
        Assert.ThrowsAny<ArgumentException>(() => Env.Has(name!));
    }

    [Theory]
    [InlineData("42", 42)]
    [InlineData("-7", -7)]
    [InlineData("0", 0)]
    [InlineData("  13  ", 13)]
    public void IntParses(string raw, int expected) {
        Set("I", raw);
        Assert.Equal(expected, Env.Int(N("I")));
    }

    [Theory]
    [InlineData("notanumber")]
    [InlineData("3.5")]
    [InlineData("9999999999")]
    public void IntRejectsInvalid(string raw) {
        Set("I", raw);
        var ex = Assert.Throws<EnvException>(() => Env.Int(N("I")));
        Assert.Contains("int", ex.Message);
        Assert.Contains(raw.Trim(), ex.Message);
    }

    [Fact]
    public void IntFallbackBehaviour() {
        Assert.Equal(3000, Env.Int(N("ABSENT"), 3000));
        Set("I", "8080");
        Assert.Equal(8080, Env.Int(N("I"), 3000));
        Set("BAD", "nope");
        Assert.Throws<EnvException>(() => Env.Int(N("BAD"), 3000));
    }

    [Fact]
    public void LongParsesBeyondIntRange() {
        Set("L", "9999999999");
        Assert.Equal(9999999999L, Env.Long(N("L")));
        Assert.Equal(5L, Env.Long(N("ABSENT"), 5L));
        Set("BADL", "x");
        Assert.Throws<EnvException>(() => Env.Long(N("BADL")));
    }

    [Theory]
    [InlineData("1.5", 1.5)]
    [InlineData("-2.25", -2.25)]
    [InlineData("1e3", 1000)]
    public void DoubleParses(string raw, double expected) {
        Set("D", raw);
        Assert.Equal(expected, Env.Double(N("D")));
    }

    [Fact]
    public void DoubleFallbackAndInvalid() {
        Assert.Equal(2.5, Env.Double(N("ABSENT"), 2.5));
        Set("BADD", "abc");
        Assert.Throws<EnvException>(() => Env.Double(N("BADD")));
    }

    [Theory]
    [InlineData("1.5", "1.5")]
    [InlineData("1,000", "1000")]
    [InlineData("-3.14", "-3.14")]
    public void DecimalParses(string raw, string expected) {
        Set("DEC", raw);
        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), Env.Decimal(N("DEC")));
    }

    [Fact]
    public void DecimalFallbackAndInvalid() {
        Assert.Equal(9.99m, Env.Decimal(N("ABSENT"), 9.99m));
        Set("BADDEC", "money");
        Assert.Throws<EnvException>(() => Env.Decimal(N("BADDEC")));
    }

    [Theory]
    [InlineData("1", true)]
    [InlineData("true", true)]
    [InlineData("TRUE", true)]
    [InlineData("t", true)]
    [InlineData("yes", true)]
    [InlineData("y", true)]
    [InlineData("on", true)]
    [InlineData("  On  ", true)]
    [InlineData("0", false)]
    [InlineData("false", false)]
    [InlineData("F", false)]
    [InlineData("no", false)]
    [InlineData("n", false)]
    [InlineData("off", false)]
    public void BoolIsLenient(string raw, bool expected) {
        Set("B", raw);
        Assert.Equal(expected, Env.Bool(N("B")));
    }

    [Fact]
    public void BoolFallbackAndInvalid() {
        Assert.True(Env.Bool(N("ABSENT"), true));
        Assert.False(Env.Bool(N("ABSENT"), false));
        Set("BADB", "maybe");
        Assert.Throws<EnvException>(() => Env.Bool(N("BADB")));
    }

    [Theory]
    [InlineData("30s", 30_000)]
    [InlineData("5m", 300_000)]
    [InlineData("500ms", 500)]
    [InlineData("1h", 3_600_000)]
    [InlineData("2d", 172_800_000)]
    [InlineData("1.5s", 1_500)]
    [InlineData("45", 45_000)]
    [InlineData("0.5h", 1_800_000)]
    public void DurationParsesUnits(string raw, long expectedMs) {
        Set("TTL", raw);
        Assert.Equal(TimeSpan.FromMilliseconds(expectedMs), Env.Duration(N("TTL")));
    }

    [Fact]
    public void DurationParsesTimeSpanFormat() {
        Set("TTL", "00:05:00");
        Assert.Equal(TimeSpan.FromMinutes(5), Env.Duration(N("TTL")));
    }

    [Fact]
    public void DurationFallbackAndInvalid() {
        Assert.Equal(TimeSpan.FromSeconds(10), Env.Duration(N("ABSENT"), TimeSpan.FromSeconds(10)));
        Set("BADT", "soon");
        Assert.Throws<EnvException>(() => Env.Duration(N("BADT")));
    }

    [Fact]
    public void GuidParsesAndRejects() {
        Set("GID", "550e8400-e29b-41d4-a716-446655440000");
        Assert.Equal(System.Guid.Parse("550e8400-e29b-41d4-a716-446655440000"), Env.Guid(N("GID")));
        Set("BADG", "not-a-guid");
        Assert.Throws<EnvException>(() => Env.Guid(N("BADG")));
    }

    [Fact]
    public void UriRequiresAbsolute() {
        Set("URL", "https://example.com/api");
        Assert.Equal(new Uri("https://example.com/api"), Env.Uri(N("URL")));
        Set("REL", "foo/bar");
        Assert.Throws<EnvException>(() => Env.Uri(N("REL")));
    }

    [Fact]
    public void EnumParsesCaseInsensitiveAndRejects() {
        Set("MODE", "production");
        Assert.Equal(Mode.Production, Env.Enum<Mode>(N("MODE")));
        Set("MODE2", "STAGING");
        Assert.Equal(Mode.Staging, Env.Enum<Mode>(N("MODE2")));
        Assert.Equal(Mode.Staging, Env.Enum<Mode>(N("ABSENT"), Mode.Staging));
        Set("BADMODE", "nonsense");
        Assert.Throws<EnvException>(() => Env.Enum<Mode>(N("BADMODE")));
    }

    [Fact]
    public void ListSplitsTrimsAndDropsEmpty() {
        Set("ORIGINS", "a.com, b.com ,, c.com");
        Assert.Equal(["a.com", "b.com", "c.com"], Env.List(N("ORIGINS")));
    }

    [Fact]
    public void ListEdgeCases() {
        Assert.Empty(Env.List(N("ABSENT")));
        Set("ONE", "solo");
        Assert.Equal(["solo"], Env.List(N("ONE")));
        Set("SEPS", ",,,");
        Assert.Empty(Env.List(N("SEPS")));
        Set("SEMI", "a;b;c");
        Assert.Equal(["a", "b", "c"], Env.List(N("SEMI"), ';'));
    }

    [Fact]
    public void RequirePassesWhenAllPresent() {
        Set("R1", "a");
        Set("R2", "b");
        Env.Require(N("R1"), N("R2"));
        Env.Require();
    }

    [Fact]
    public void RequireListsEveryMissing() {
        Set("PRESENT", "x");
        Set("BLANK", "");
        var ex = Assert.Throws<EnvException>(() =>
            Env.Require(N("PRESENT"), N("BLANK"), N("GONE")));
        Assert.Contains(N("BLANK"), ex.Message);
        Assert.Contains(N("GONE"), ex.Message);
        Assert.DoesNotContain(N("PRESENT"), ex.Message);
    }

    [Fact]
    public void LoadAcceptsArrayOfPathsFirstWins() {
        var first = TempEnv($"{N("A")}=base\n{N("SHARED")}=fromfirst\n");
        var second = TempEnv($"{N("B")}=other\n{N("SHARED")}=fromsecond\n");
        Touched.Add(N("A"));
        Touched.Add(N("B"));
        Touched.Add(N("SHARED"));
        try {
            Env.Load([first, second]);
            Assert.Equal("base", Env.Get(N("A")));
            Assert.Equal("other", Env.Get(N("B")));
            Assert.Equal("fromfirst", Env.Get(N("SHARED")));
        } finally {
            File.Delete(first);
            File.Delete(second);
        }
    }

    [Fact]
    public void LoadDoesNotOverrideButOverloadDoes() {
        Set("EXISTING", "original");
        var path = TempEnv($"{N("EXISTING")}=fromfile\n");
        try {
            Env.Load(path);
            Assert.Equal("original", Env.Get(N("EXISTING")));
            Env.Overload(path);
            Assert.Equal("fromfile", Env.Get(N("EXISTING")));
        } finally {
            File.Delete(path);
        }
    }

    [Fact]
    public void MissingFileIsNoOp() {
        Env.Load(Path.Combine(Path.GetTempPath(), Prefix + "does-not-exist.env"));
    }

    [Fact]
    public void FileSkipsBlankCommentAndMalformedLines() {
        var path = TempEnv(
            "\n" +
            "# a comment\n" +
            "   \n" +
            "\t\n" +
            "NO_EQUALS_HERE\n" +
            $"={N("LEADEQ")}\n" +
            $"{N("REAL1")}=one\n" +
            $"{N("REAL2")}=two\n");
        Touched.Add(N("REAL1"));
        Touched.Add(N("REAL2"));
        try {
            Env.Overload(path);
            Assert.Equal("one", Env.Get(N("REAL1")));
            Assert.Equal("two", Env.Get(N("REAL2")));
        } finally {
            File.Delete(path);
        }
    }

    [Fact]
    public void CommentLineIgnored() =>
        Assert.Null(ParseRaw(N("C"), $"# {N("C")}=x"));

    [Fact]
    public void LineWithoutEqualsIgnored() =>
        Assert.Null(ParseRaw(N("NE"), N("NE")));

    [Fact]
    public void LeadingEqualsIgnored() =>
        Assert.Null(ParseRaw(N("LE"), $"={N("LE")}"));

    [Fact]
    public void InvalidKeyCharactersIgnored() =>
        Assert.Null(ParseRaw(N("BAD") + "-X", $"{N("BAD")}-X=value"));

    [Fact]
    public void DigitLeadingKeyIgnored() =>
        Assert.Null(ParseRaw("9" + N("DIGIT"), $"9{N("DIGIT")}=value"));

    [Fact]
    public void UnderscoreKeyAccepted() =>
        Assert.Equal("ok", ParseRaw("_" + N("US"), $"_{N("US")}=ok"));

    [Fact]
    public void ExportPrefixStripped() =>
        Assert.Equal("exported", ParseRaw(N("EXP"), $"export {N("EXP")}=exported"));

    [Fact]
    public void ExportWithExtraSpacesStripped() =>
        Assert.Equal("v", ParseRaw(N("EXP2"), $"export   {N("EXP2")}=v"));

    [Fact]
    public void WhitespaceAroundKeyAndValueTrimmed() =>
        Assert.Equal("value", ParseRaw(N("SP"), $"{N("SP")}  =  value"));

    [Fact]
    public void ValueMayContainEquals() =>
        Assert.Equal("a=b=c", ParseRaw(N("EQ"), $"{N("EQ")}=a=b=c"));

    [Fact]
    public void EmptyValueStoredAsEmpty() =>
        Assert.Equal("", ParseRaw(N("MT"), $"{N("MT")}="));

    [Fact]
    public void DoubleQuotedEmptyIsEmpty() =>
        Assert.Equal("", ParseRaw(N("QMT"), $"{N("QMT")}=\"\""));

    [Fact]
    public void DoubleQuotedPreservesSpaces() =>
        Assert.Equal("  x y  ", ParseRaw(N("DQ"), $"{N("DQ")}=\"  x y  \""));

    [Fact]
    public void DoubleQuotedUnescapesSequences() =>
        Assert.Equal("a\tb\nc\"d\\e", ParseRaw(N("ESC"), $"{N("ESC")}=\"a\\tb\\nc\\\"d\\\\e\""));

    [Fact]
    public void DoubleQuotedUnknownEscapeKeepsChar() =>
        Assert.Equal("aqb", ParseRaw(N("UE"), $"{N("UE")}=\"a\\qb\""));

    [Fact]
    public void DoubleQuotedTrailingBackslash() =>
        Assert.Equal("ends\\", ParseRaw(N("TB"), $"{N("TB")}=\"ends\\\\\""));

    [Fact]
    public void SingleQuotedIsLiteral() =>
        Assert.Equal("a\\n ${X}", ParseRaw(N("SQ"), $"{N("SQ")}='a\\n ${{X}}'"));

    [Fact]
    public void InlineCommentStrippedFromUnquoted() =>
        Assert.Equal("bare", ParseRaw(N("IC"), $"{N("IC")}=bare # trailing note"));

    [Fact]
    public void HashWithoutLeadingSpaceKept() =>
        Assert.Equal("a#b", ParseRaw(N("NH"), $"{N("NH")}=a#b"));

    [Fact]
    public void UnquotedExpandsReference() {
        Set("BASE", "yo");
        Assert.Equal("pre-yo", ParseRaw(N("REF"), $"{N("REF")}=pre-${{{N("BASE")}}}"));
    }

    [Fact]
    public void UndefinedReferenceExpandsEmpty() =>
        Assert.Equal("xy", ParseRaw(N("U"), $"{N("U")}=x${{{N("MISSING")}}}y"));

    [Fact]
    public void EmptyBraceReferenceExpandsEmpty() =>
        Assert.Equal("ab", ParseRaw(N("EB"), $"{N("EB")}=a${{}}b"));

    [Fact]
    public void UnclosedReferenceKeptLiteral() =>
        Assert.Equal("a${X", ParseRaw(N("UC"), $"{N("UC")}=a${{X"));

    [Fact]
    public void DollarWithoutBraceKeptLiteral() =>
        Assert.Equal("price-$5", ParseRaw(N("DOL"), $"{N("DOL")}=price-$5"));

    [Fact]
    public void MultipleReferencesExpand() {
        Set("XA", "va");
        Set("XB", "vb");
        Assert.Equal("va-vb", ParseRaw(N("MULTI"), $"{N("MULTI")}=${{{N("XA")}}}-${{{N("XB")}}}"));
    }

    private enum Mode {
        Staging,
        Production,
    }
}
