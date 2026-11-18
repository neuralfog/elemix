use oxc_ast::ast::{
    BindingPattern, CallExpression, Expression, IdentifierReference, NewExpression, Program,
    TaggedTemplateExpression, ThisExpression, VariableDeclaration,
};
use oxc_ast_visit::{walk, Visit};
use oxc_semantic::{Scoping, SemanticBuilder, SymbolId};
use oxc_span::GetSpan;
use std::collections::{HashMap, HashSet};

pub fn source_free_map(source: &str, program: &Program<'_>) -> HashMap<String, bool> {
    let semantic = SemanticBuilder::new().build(program).semantic;
    let scoping = semantic.scoping();

    let mut statics = StaticSyms {
        symbols: HashSet::new(),
    };
    statics.visit_program(program);

    let mut collector = Collector {
        source,
        statics: &statics.symbols,
        scoping,
        map: HashMap::new(),
    };
    collector.visit_program(program);
    collector.map
}

fn is_literal_init(e: &Expression) -> bool {
    match e {
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::BigIntLiteral(_) => true,
        Expression::TemplateLiteral(t) => t.expressions.is_empty(),
        _ => false,
    }
}

struct StaticSyms {
    symbols: HashSet<SymbolId>,
}

impl<'a> Visit<'a> for StaticSyms {
    fn visit_variable_declaration(&mut self, it: &VariableDeclaration<'a>) {
        if it.kind.is_const() {
            for d in &it.declarations {
                if let (Some(init), BindingPattern::BindingIdentifier(bi)) = (&d.init, &d.id) {
                    if is_literal_init(init) {
                        if let Some(id) = bi.symbol_id.get() {
                            self.symbols.insert(id);
                        }
                    }
                }
            }
        }
        walk::walk_variable_declaration(self, it);
    }
}

struct Collector<'s> {
    source: &'s str,
    statics: &'s HashSet<SymbolId>,
    scoping: &'s Scoping,
    map: HashMap<String, bool>,
}

impl<'a> Visit<'a> for Collector<'_> {
    fn visit_tagged_template_expression(&mut self, it: &TaggedTemplateExpression<'a>) {
        if let Expression::Identifier(id) = &it.tag {
            if id.name == "tpl" {
                for e in &it.quasi.expressions {
                    let span = e.span();
                    let text = self.source[span.start as usize..span.end as usize]
                        .trim()
                        .to_string();
                    let mut check = FreeCheck {
                        statics: self.statics,
                        scoping: self.scoping,
                        free: true,
                    };
                    check.visit_expression(e);
                    self.map
                        .entry(text)
                        .and_modify(|v| *v = *v && check.free)
                        .or_insert(check.free);
                }
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }
}

struct FreeCheck<'s> {
    statics: &'s HashSet<SymbolId>,
    scoping: &'s Scoping,
    free: bool,
}

impl<'a> Visit<'a> for FreeCheck<'_> {
    fn visit_this_expression(&mut self, _it: &ThisExpression) {
        self.free = false;
    }

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        self.free = false;
        walk::walk_call_expression(self, it);
    }

    fn visit_new_expression(&mut self, it: &NewExpression<'a>) {
        self.free = false;
        walk::walk_new_expression(self, it);
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        let is_static = it
            .reference_id
            .get()
            .and_then(|rid| self.scoping.get_reference(rid).symbol_id())
            .is_some_and(|sid| self.statics.contains(&sid));
        if !is_static {
            self.free = false;
        }
    }
}
