using System.Linq;
using System.Text;
using Microsoft.CodeAnalysis;

namespace Hydris.Generators;

internal static class JsonRead {
    private static readonly SymbolDisplayFormat FullyQualified = SymbolDisplayFormat.FullyQualifiedFormat;

    public static void EmitValue(StringBuilder sb, string indent, ITypeSymbol type, string target, int depth) {
        var underlying = UnwrapNullable(type);
        if (underlying is not null) {
            sb.Append(indent).AppendLine("if (reader.TokenType == global::System.Text.Json.JsonTokenType.Null)");
            sb.Append(indent).Append("    ").Append(target).AppendLine(" = null;");
            sb.Append(indent).AppendLine("else");
            sb.Append(indent).AppendLine("{");
            EmitValue(sb, indent + "    ", underlying, target, depth);
            sb.Append(indent).AppendLine("}");
            return;
        }

        if (type.SpecialType == SpecialType.System_String) {
            sb.Append(indent).Append(target).AppendLine(" = reader.GetString() ?? string.Empty;");
            return;
        }
        if (type.SpecialType == SpecialType.System_Boolean) {
            sb.Append(indent).Append(target).AppendLine(" = reader.GetBoolean();");
            return;
        }
        var numeric = NumericReader(type.SpecialType);
        if (numeric is not null) {
            sb.Append(indent).Append(target).Append(" = reader.").Append(numeric).AppendLine("();");
            return;
        }
        if (type.TypeKind == TypeKind.Enum) {
            var full = type.ToDisplayString(FullyQualified);
            sb.Append(indent).Append(target).AppendLine(" = reader.GetString() switch");
            sb.Append(indent).AppendLine("{");
            foreach (var member in type.GetMembers()) {
                if (member is IFieldSymbol { IsStatic: true } field)
                    sb.Append(indent).Append("    \"").Append(field.Name).Append("\" => ").Append(full).Append('.').Append(field.Name).AppendLine(",");
            }
            sb.Append(indent).AppendLine("    _ => default,");
            sb.Append(indent).AppendLine("};");
            return;
        }
        var fullType = type.ToDisplayString(FullyQualified);
        if (fullType == "global::System.DateTime") {
            sb.Append(indent).Append(target).AppendLine(" = reader.GetDateTime();");
            return;
        }
        if (fullType == "global::System.DateTimeOffset") {
            sb.Append(indent).Append(target).AppendLine(" = reader.GetDateTimeOffset();");
            return;
        }
        if (fullType == "global::System.Guid") {
            sb.Append(indent).Append(target).AppendLine(" = reader.GetGuid();");
            return;
        }
        if (IsContract(type)) {
            sb.Append(indent).Append(target).Append(" = ").Append(fullType).AppendLine(".ReadFrom(ref reader, errors);");
            return;
        }
        var element = ElementType(type);
        if (element is not null) {
            var list = $"__l{depth}";
            var item = $"__e{depth}";
            var elementFull = element.ToDisplayString(FullyQualified);
            sb.Append(indent).Append("var ").Append(list).Append(" = new global::System.Collections.Generic.List<").Append(elementFull).AppendLine(">();");
            sb.Append(indent).AppendLine("while (reader.Read() && reader.TokenType != global::System.Text.Json.JsonTokenType.EndArray)");
            sb.Append(indent).AppendLine("{");
            sb.Append(indent).Append("    ").Append(elementFull).Append(' ').Append(item).AppendLine(" = default!;");
            EmitValue(sb, indent + "    ", element, item, depth + 1);
            sb.Append(indent).Append("    ").Append(list).Append(".Add(").Append(item).AppendLine(");");
            sb.Append(indent).AppendLine("}");
            sb.Append(indent).Append(target).Append(" = ").Append(list);
            sb.AppendLine(type is IArrayTypeSymbol ? ".ToArray();" : ";");
            return;
        }

        sb.Append(indent).AppendLine("reader.Skip();");
    }

    private static string? NumericReader(SpecialType type) => type switch {
        SpecialType.System_Byte => "GetByte",
        SpecialType.System_SByte => "GetSByte",
        SpecialType.System_Int16 => "GetInt16",
        SpecialType.System_UInt16 => "GetUInt16",
        SpecialType.System_Int32 => "GetInt32",
        SpecialType.System_UInt32 => "GetUInt32",
        SpecialType.System_Int64 => "GetInt64",
        SpecialType.System_UInt64 => "GetUInt64",
        SpecialType.System_Single => "GetSingle",
        SpecialType.System_Double => "GetDouble",
        SpecialType.System_Decimal => "GetDecimal",
        _ => null,
    };

    private static ITypeSymbol? UnwrapNullable(ITypeSymbol type) =>
        type is INamedTypeSymbol named && named.OriginalDefinition.SpecialType == SpecialType.System_Nullable_T
            ? named.TypeArguments[0]
            : null;

    private static bool IsContract(ITypeSymbol type) =>
        type.GetAttributes().Any(static a => a.AttributeClass?.ToDisplayString() == "Hydris.Contracts.ContractAttribute");

    private static ITypeSymbol? ElementType(ITypeSymbol type) {
        if (type is IArrayTypeSymbol array)
            return array.ElementType;
        if (type.SpecialType == SpecialType.System_String)
            return null;
        foreach (var candidate in type.AllInterfaces) {
            if (candidate.OriginalDefinition.SpecialType == SpecialType.System_Collections_Generic_IEnumerable_T)
                return candidate.TypeArguments[0];
        }

        return null;
    }
}
