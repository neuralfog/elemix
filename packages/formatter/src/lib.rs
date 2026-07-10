//! `etf` as a library: the formatting engine, exposed so the binary and the
//! integration tests (fixtures + snapshots) share one entry point. Standalone -
//! no `elemix-compiler`/`elemix-analyzer` dependency (see spec.md).

pub mod doc;
pub mod format;
pub mod report;

mod html;
mod scan;

pub use doc::Options;
pub use format::{format_source, Formatted};
