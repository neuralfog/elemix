using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hydris.Build;
using Hydris.QuickJs;

var optimise = args.Contains("-O");
var positional = args.Where(a => !a.StartsWith('-')).ToArray();
var root = Path.GetFullPath(positional.Length > 0 ? positional[0] : Directory.GetCurrentDirectory());
var viewsRoot = positional.Length > 1 ? Path.GetFullPath(positional[1]) : root;
Brand.Banner();
var views = ViewDiscovery.Scan(root, viewsRoot);

if (views.Count == 0) {
    Brand.Info($"no Reply.View(\"...\") references found under {root}");
    return 0;
}

var missing = 0;
foreach (var view in views) {
    if (!view.Exists) {
        Brand.Error($"missing view source: {view.Source}");
        missing++;
    }
}

if (missing > 0)
    return 1;

var entries = new ViewEntry[views.Count];
for (var i = 0; i < views.Count; i++)
    entries[i] = new ViewEntry(views[i].Key, views[i].Source, views[i].Export);

var viewsJson = Path.Combine(root, ".hydris-views.json");
File.WriteAllText(viewsJson, JsonSerializer.Serialize(entries, BuildJson.Default.ViewEntryArray));

var start = new ProcessStartInfo("bun") {
    UseShellExecute = false,
    WorkingDirectory = root,
};
start.ArgumentList.Add("-e");
start.ArgumentList.Add(
    "const { build } = await import('@neuralfog/elemix-ssr/build'); process.exit(await build(process.env.HYDRIS_VIEWS, process.env.HYDRIS_ROOT));");
start.Environment["HYDRIS_VIEWS"] = viewsJson;
start.Environment["HYDRIS_ROOT"] = root;
if (optimise)
    start.Environment["ELEMIX_OPTIMISE"] = "1";

Brand.Info($"building {views.Count} view(s) from {root}");
Brand.Blank();
var process = Process.Start(start);
if (process is null) {
    Brand.Error("failed to start bun (is it on PATH?)");
    File.Delete(viewsJson);
    return 1;
}

int exitCode;
using (process) {
    process.WaitForExit();
    exitCode = process.ExitCode;
}
File.Delete(viewsJson);
if (exitCode != 0)
    return exitCode;

var bytecodeCount = 0;
var ssrDir = Path.Combine(root, "ssr");
if (Directory.Exists(ssrDir)) {
    var bundles = Directory.GetFiles(ssrDir, "*.js", SearchOption.AllDirectories);
    Array.Sort(bundles, StringComparer.Ordinal);
    if (bundles.Length > 0)
        Brand.Blank();
    foreach (var js in bundles) {
        var ebc = Path.ChangeExtension(js, ".ebc");
        var code = BytecodeCompiler.Compile(File.ReadAllText(js));
        File.WriteAllBytes(ebc, code);
        File.Delete(js);
        Brand.Bytecode(Path.GetRelativePath(root, ebc).Replace('\\', '/'), code.Length);
    }

    bytecodeCount = bundles.Length;
}

var clientDir = Path.Combine(root, "public", "_elemix");
long compressedFrom = 0;
long compressedTo = 0;
if (Directory.Exists(clientDir)) {
    var assets = Directory.GetFiles(clientDir, "*.js", SearchOption.AllDirectories);
    Array.Sort(assets, StringComparer.Ordinal);
    if (assets.Length > 0)
        Brand.Blank();
    foreach (var asset in assets) {
        var result = AssetCompressor.Compress(asset);
        compressedFrom += result.Raw;
        compressedTo += result.Brotli;
        Brand.Compress(Path.GetRelativePath(root, asset).Replace('\\', '/'), result.Raw, result.Brotli);
    }
}

var statsPath = Path.Combine(root, ".hydris-stats.json");
BuildStats? stats = File.Exists(statsPath)
    ? JsonSerializer.Deserialize(File.ReadAllText(statsPath), BuildJson.Default.BuildStats)
    : null;
if (File.Exists(statsPath))
    File.Delete(statsPath);

Brand.Summary(
    stats?.Views ?? views.Count,
    optimise ? stats?.Optimised ?? 0 : -1,
    stats?.Hydrate ?? 0,
    bytecodeCount,
    compressedFrom,
    compressedTo);

return 0;

internal sealed record ViewEntry(string Key, string Source, string? Export);

internal sealed record BuildStats(int Views, int Optimised, int Hydrate);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ViewEntry[]))]
[JsonSerializable(typeof(BuildStats))]
internal sealed partial class BuildJson : JsonSerializerContext;
