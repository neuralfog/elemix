using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Hydris.Cli.Config;

public static class ConfigLoader {
    private const string FileName = "hydris.yml";
    private const string AltFileName = "hydris.yaml";

    public static LoadedConfig? Find(string startDir) {
        var dir = new DirectoryInfo(Path.GetFullPath(startDir));
        while (dir is not null) {
            var candidate = FindIn(dir.FullName);
            if (candidate is not null)
                return Load(candidate);
            dir = dir.Parent;
        }
        return null;
    }

    private static string? FindIn(string dir) {
        var primary = Path.Combine(dir, FileName);
        if (File.Exists(primary))
            return primary;
        var alt = Path.Combine(dir, AltFileName);
        return File.Exists(alt) ? alt : null;
    }

    public static HydrisFile Parse(string text) {
        var deserializer = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .WithTypeConverter(new CommandListConverter())
            .IgnoreUnmatchedProperties()
            .Build();
        return deserializer.Deserialize<HydrisFile>(text) ?? new HydrisFile();
    }

    private static LoadedConfig Load(string path) {
        var file = Parse(File.ReadAllText(path));
        return new LoadedConfig {
            File = file,
            Path = path,
            RootDir = Path.GetDirectoryName(path) ?? Directory.GetCurrentDirectory(),
        };
    }
}
