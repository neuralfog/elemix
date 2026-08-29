using System.Collections.Frozen;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Hydris.Http;

internal sealed class ElemixManifest {
    private readonly FrozenDictionary<string, string> Map;

    private ElemixManifest(FrozenDictionary<string, string> map) => Map = map;

    public string? Resolve(string name) => Map.GetValueOrDefault(name);

    public static ElemixManifest Load(string path) {
        ArgumentException.ThrowIfNullOrEmpty(path);
        if (!File.Exists(path))
            return new ElemixManifest(FrozenDictionary<string, string>.Empty);

        var parsed = JsonSerializer.Deserialize(File.ReadAllText(path), ManifestJson.Default.DictionaryStringString);
        return new ElemixManifest(parsed?.ToFrozenDictionary() ?? FrozenDictionary<string, string>.Empty);
    }
}

[JsonSerializable(typeof(Dictionary<string, string>))]
internal sealed partial class ManifestJson : JsonSerializerContext;
