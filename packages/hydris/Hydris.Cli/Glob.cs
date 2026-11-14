using System.Text;
using System.Text.RegularExpressions;

namespace Hydris.Cli;

public sealed class Glob {
    private readonly Regex Pattern;
    public string BaseDir { get; }

    private Glob(string baseDir, Regex pattern) {
        BaseDir = baseDir;
        Pattern = pattern;
    }

    public bool IsMatch(string relativePath) => Pattern.IsMatch(relativePath.Replace('\\', '/'));

    public static Glob Compile(string raw) {
        var p = raw.Replace('\\', '/');
        if (p.StartsWith("./", StringComparison.Ordinal))
            p = p[2..];

        var segments = p.Split('/');
        var baseParts = new List<string>();
        foreach (var seg in segments) {
            if (seg.Contains('*') || seg.Contains('?') || seg.Contains('['))
                break;
            baseParts.Add(seg);
        }

        var baseDir = baseParts.Count == 0 ? "." : string.Join('/', baseParts);
        var literalDir = baseParts.Count == segments.Length && Directory.Exists(raw);
        var glob = literalDir ? $"{p.TrimEnd('/')}/**" : p;
        return new Glob(baseDir, ToRegex(glob));
    }

    private static Regex ToRegex(string glob) {
        var sb = new StringBuilder("^");
        for (var i = 0; i < glob.Length; i++) {
            var c = glob[i];
            if (c == '*') {
                if (i + 1 < glob.Length && glob[i + 1] == '*') {
                    if (i + 2 < glob.Length && glob[i + 2] == '/') {
                        sb.Append("(?:.*/)?");
                        i += 2;
                    } else {
                        sb.Append(".*");
                        i++;
                    }
                } else {
                    sb.Append("[^/]*");
                }
            } else if (c == '?') {
                sb.Append("[^/]");
            } else if ("+()^$.{}[]|\\".Contains(c)) {
                sb.Append('\\').Append(c);
            } else {
                sb.Append(c);
            }
        }
        sb.Append('$');
        return new Regex(sb.ToString(), RegexOptions.Compiled);
    }
}
