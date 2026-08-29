using System.Text.Json;

namespace Hydris.Http;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct, Inherited = false)]
public sealed class ViewDataAttribute : Attribute;

public interface IViewData {
    void Write(Utf8JsonWriter writer);
}
