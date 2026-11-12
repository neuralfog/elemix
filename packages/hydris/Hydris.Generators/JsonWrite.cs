using System.Linq;
using System.Text;
using Microsoft.CodeAnalysis;

namespace Hydris.Generators;

internal static class JsonWrite {
    private static readonly SymbolDisplayFormat FullyQualified = SymbolDisplayFormat.FullyQualifiedFormat;

    public static void EmitMember(
        SourceProductionContext production,
        DiagnosticDescriptor unsupported,
        StringBuilder sb,
        string indent,
        string? name,
        ITypeSymbol type,
        string expr,
        Location? location,
        string memberName,
        int depth) {
        var underlying = UnwrapNullable(type);
        if (underlying is not null) {
            sb.Append(indent).Append("if (").Append(expr).AppendLine(".HasValue)");
            sb.Append(indent).AppendLine("{");
            EmitMember(production, unsupported, sb, indent + "    ", name, underlying, $"{expr}.Value", location, memberName, depth);
            sb.Append(indent).AppendLine("}");
            sb.Append(indent).AppendLine("else");
            sb.Append(indent).AppendLine("{");
            sb.Append(indent).Append("    ").AppendLine(name is null ? "writer.WriteNullValue();" : $"writer.WriteNull({name});");
            sb.Append(indent).AppendLine("}");
            return;
        }

        if (type.SpecialType == SpecialType.System_String) {
            Scalar(sb, indent, name, "String", expr);
            return;
        }
        if (type.SpecialType == SpecialType.System_Boolean) {
            Scalar(sb, indent, name, "Boolean", expr);
            return;
        }
        if (IsNumeric(type.SpecialType)) {
            Scalar(sb, indent, name, "Number", expr);
            return;
        }
        if (type.TypeKind == TypeKind.Enum) {
            Scalar(sb, indent, name, "String", $"{expr}.ToString()");
            return;
        }
        var full = type.ToDisplayString(FullyQualified);
        if (full is "global::System.Guid" or "global::System.DateTime" or "global::System.DateTimeOffset") {
            Scalar(sb, indent, name, "String", expr);
            return;
        }
        if (ImplementsViewData(type)) {
            Nested(sb, indent, name, expr);
            return;
        }
        var element = ElementType(type);
        if (element is not null) {
            Sequence(production, unsupported, sb, indent, name, element, expr, location, memberName, depth);
            return;
        }

        production.ReportDiagnostic(Diagnostic.Create(unsupported, location, memberName, type.ToDisplayString()));
    }

    private static void Scalar(StringBuilder sb, string indent, string? name, string kind, string expr) {
        sb.Append(indent).Append("writer.Write").Append(kind);
        sb.Append(name is null ? "Value(" : $"({name}, ");
        sb.Append(expr).AppendLine(");");
    }

    private static void Nested(StringBuilder sb, string indent, string? name, string expr) {
        if (name is not null)
            sb.Append(indent).Append("writer.WritePropertyName(").Append(name).AppendLine(");");
        sb.Append(indent).Append("if (").Append(expr).AppendLine(" is null) { writer.WriteNullValue(); }");
        sb.Append(indent).Append("else { ((global::Hydris.Http.IViewData)").Append(expr).AppendLine(").Write(writer); }");
    }

    private static void Sequence(
        SourceProductionContext production,
        DiagnosticDescriptor unsupported,
        StringBuilder sb,
        string indent,
        string? name,
        ITypeSymbol element,
        string expr,
        Location? location,
        string memberName,
        int depth) {
        var item = $"__e{depth}";
        if (name is not null)
            sb.Append(indent).Append("writer.WritePropertyName(").Append(name).AppendLine(");");
        sb.Append(indent).Append("if (").Append(expr).AppendLine(" is null) { writer.WriteNullValue(); }");
        sb.Append(indent).AppendLine("else");
        sb.Append(indent).AppendLine("{");
        sb.Append(indent).AppendLine("    writer.WriteStartArray();");
        sb.Append(indent).Append("    foreach (var ").Append(item).Append(" in ").Append(expr).AppendLine(")");
        sb.Append(indent).AppendLine("    {");
        EmitMember(production, unsupported, sb, indent + "        ", null, element, item, location, memberName, depth + 1);
        sb.Append(indent).AppendLine("    }");
        sb.Append(indent).AppendLine("    writer.WriteEndArray();");
        sb.Append(indent).AppendLine("}");
    }

    private static ITypeSymbol? UnwrapNullable(ITypeSymbol type) =>
        type is INamedTypeSymbol named && named.OriginalDefinition.SpecialType == SpecialType.System_Nullable_T
            ? named.TypeArguments[0]
            : null;

    private static bool IsNumeric(SpecialType type) => type
        is SpecialType.System_Byte
        or SpecialType.System_SByte
        or SpecialType.System_Int16
        or SpecialType.System_UInt16
        or SpecialType.System_Int32
        or SpecialType.System_UInt32
        or SpecialType.System_Int64
        or SpecialType.System_UInt64
        or SpecialType.System_Single
        or SpecialType.System_Double
        or SpecialType.System_Decimal;

    private static bool ImplementsViewData(ITypeSymbol type) =>
        type.AllInterfaces.Any(static i => i.ToDisplayString(FullyQualified) == "global::Hydris.Http.IViewData")
        || type.GetAttributes().Any(static a => a.AttributeClass?.ToDisplayString() == "Hydris.Http.ViewDataAttribute"
            || a.AttributeClass?.ToDisplayString() == "Hydris.Contracts.ContractAttribute");

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
