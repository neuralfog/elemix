namespace Hydris.Cli.Builtins;

public static class BuiltinCommands {
    private static readonly HashSet<string> Names = new(StringComparer.Ordinal) {
        "rm", "cp", "mkdir", "mv", "env",
    };

    public static bool IsBuiltin(string name) => Names.Contains(name);

    public static int Run(string name, string[] args) {
        return name switch {
            "rm" => Rm(args),
            "cp" => Cp(args),
            "mkdir" => Mkdir(args),
            "mv" => Mv(args),
            "env" => EnvPrint(),
            _ => 1,
        };
    }

    private static int Rm(string[] args) {
        var (flags, operands) = Split(args);
        var recursive = flags.Contains('r');
        var force = flags.Contains('f');
        foreach (var target in operands) {
            try {
                if (Directory.Exists(target)) {
                    if (!recursive) {
                        Brand.Error($"rm: '{target}' is a directory (use -r)");
                        return 1;
                    }
                    Directory.Delete(target, true);
                } else if (File.Exists(target)) {
                    File.Delete(target);
                } else if (!force) {
                    Brand.Error($"rm: '{target}' does not exist");
                    return 1;
                }
            } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) {
                if (!force) {
                    Brand.Error($"rm: {ex.Message}");
                    return 1;
                }
            }
        }
        return 0;
    }

    private static int Cp(string[] args) {
        var (flags, operands) = Split(args);
        if (operands.Count < 2) {
            Brand.Error("cp: expected <source> <dest>");
            return 1;
        }
        var recursive = flags.Contains('r');
        var dest = operands[^1];
        for (var i = 0; i < operands.Count - 1; i++) {
            var source = operands[i];
            if (Directory.Exists(source)) {
                if (!recursive) {
                    Brand.Error($"cp: '{source}' is a directory (use -r)");
                    return 1;
                }
                CopyDir(source, Path.Combine(dest, Path.GetFileName(source.TrimEnd(Path.DirectorySeparatorChar))));
            } else if (File.Exists(source)) {
                var file = Directory.Exists(dest) ? Path.Combine(dest, Path.GetFileName(source)) : dest;
                var parent = Path.GetDirectoryName(file);
                if (!string.IsNullOrEmpty(parent))
                    Directory.CreateDirectory(parent);
                File.Copy(source, file, true);
            } else {
                Brand.Error($"cp: '{source}' does not exist");
                return 1;
            }
        }
        return 0;
    }

    private static int Mkdir(string[] args) {
        var (_, operands) = Split(args);
        foreach (var dir in operands)
            Directory.CreateDirectory(dir);
        return 0;
    }

    private static int Mv(string[] args) {
        var (_, operands) = Split(args);
        if (operands.Count < 2) {
            Brand.Error("mv: expected <source> <dest>");
            return 1;
        }
        var dest = operands[^1];
        for (var i = 0; i < operands.Count - 1; i++) {
            var source = operands[i];
            var target = Directory.Exists(dest) ? Path.Combine(dest, Path.GetFileName(source)) : dest;
            if (Directory.Exists(target))
                Directory.Delete(target, true);
            else if (File.Exists(target))
                File.Delete(target);

            if (Directory.Exists(source))
                Directory.Move(source, target);
            else if (File.Exists(source))
                File.Move(source, target);
            else {
                Brand.Error($"mv: '{source}' does not exist");
                return 1;
            }
        }
        return 0;
    }

    private static int EnvPrint() {
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
            Console.WriteLine($"{entry.Key}={entry.Value}");
        return 0;
    }

    private static void CopyDir(string source, string dest) {
        Directory.CreateDirectory(dest);
        foreach (var file in Directory.GetFiles(source))
            File.Copy(file, Path.Combine(dest, Path.GetFileName(file)), true);
        foreach (var dir in Directory.GetDirectories(source))
            CopyDir(dir, Path.Combine(dest, Path.GetFileName(dir)));
    }

    private static (HashSet<char> Flags, List<string> Operands) Split(string[] args) {
        var flags = new HashSet<char>();
        var operands = new List<string>();
        foreach (var arg in args) {
            if (arg.Length > 1 && arg[0] == '-') {
                foreach (var c in arg[1..])
                    flags.Add(c);
            } else {
                operands.Add(arg);
            }
        }
        return (flags, operands);
    }
}
