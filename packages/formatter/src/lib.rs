pub mod config;
pub mod doc;
pub mod format;
pub mod report;

mod html;
mod scan;

pub use doc::Options;
pub use format::{format_source, Formatted};
