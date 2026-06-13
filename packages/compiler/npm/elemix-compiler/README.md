# ⚙️ Elemix Compiler ⚠️ **Experimental**

The ahead-of-time compiler that makes [Elemix](https://www.npmjs.com/package/@neuralfog/elemix) compile-only. Written in Rust on the [oxc](https://oxc.rs) parser; this package ships a **prebuilt static binary** — no Rust toolchain required.

Installing pulls in exactly one platform binary via `optionalDependencies` (Linux is a static musl build that runs on any distro, including Alpine):

| Platform | Package |
| --- | --- |
| linux x64 | `@neuralfog/elemix-compiler-linux-x64` |
| linux arm64 | `@neuralfog/elemix-compiler-linux-arm64` |
| macOS x64 | `@neuralfog/elemix-compiler-darwin-x64` |
| macOS arm64 | `@neuralfog/elemix-compiler-darwin-arm64` |
| Windows x64 | `@neuralfog/elemix-compiler-win32-x64` |
| Windows arm64 | `@neuralfog/elemix-compiler-win32-arm64` |

## Usage

Installs two equivalent commands — `ec` (short) and `elemix-compiler`:

```sh
ec --dirs <dir|glob>... --out <dir>
ec --file <path>
```
