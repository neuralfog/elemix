using YamlDotNet.Core;
using YamlDotNet.Core.Events;
using YamlDotNet.Serialization;

namespace Hydris.Cli.Config;

public sealed class CommandList {
    public List<string> Items { get; } = new();

    public int Count => Items.Count;

    public bool IsEmpty => Items.Count == 0;

    public static CommandList Of(params string[] items) {
        var list = new CommandList();
        foreach (var item in items)
            list.Items.Add(item);
        return list;
    }
}

public sealed class CommandListConverter : IYamlTypeConverter {
    public bool Accepts(Type type) => type == typeof(CommandList);

    public object ReadYaml(IParser parser, Type type, ObjectDeserializer rootDeserializer) {
        var list = new CommandList();

        if (parser.TryConsume<Scalar>(out var scalar)) {
            if (!string.IsNullOrWhiteSpace(scalar.Value))
                list.Items.Add(scalar.Value);
            return list;
        }

        if (parser.TryConsume<SequenceStart>(out _)) {
            while (!parser.TryConsume<SequenceEnd>(out _)) {
                var item = parser.Consume<Scalar>();
                if (!string.IsNullOrWhiteSpace(item.Value))
                    list.Items.Add(item.Value);
            }
            return list;
        }

        parser.SkipThisAndNestedEvents();
        return list;
    }

    public void WriteYaml(IEmitter emitter, object? value, Type type, ObjectSerializer serializer) =>
        throw new NotSupportedException();
}
