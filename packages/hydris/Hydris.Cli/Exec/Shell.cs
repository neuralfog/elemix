using System.Runtime.InteropServices;

namespace Hydris.Cli.Exec;

public readonly record struct Invocation(string File, IReadOnlyList<string> Args);

public static class Shell {
    public static Invocation Resolve(string? shell, string script) {
        var name = shell?.Trim();
        if (string.IsNullOrEmpty(name))
            return Default(script);

        return name switch {
            "sh" => new Invocation("sh", ["-c", script]),
            "bash" => new Invocation("bash", ["-c", script]),
            "zsh" => new Invocation("zsh", ["-c", script]),
            "fish" => new Invocation("fish", ["-c", script]),
            "pwsh" => new Invocation("pwsh", ["-NoProfile", "-Command", script]),
            "powershell" => new Invocation("powershell", ["-NoProfile", "-Command", script]),
            "cmd" => new Invocation("cmd", ["/c", script]),
            "python" or "python3" => new Invocation(name, ["-c", script]),
            "node" => new Invocation("node", ["-e", script]),
            _ => new Invocation(name, ["-c", script]),
        };
    }

    private static Invocation Default(string script) {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return new Invocation("cmd", ["/c", script]);
        return new Invocation("/bin/sh", ["-c", script]);
    }
}
