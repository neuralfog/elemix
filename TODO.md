# TODO

## Next release

- hydris CLI: auto-load `.env` for the task runner. Today it only reads `--env-file <path>`, `-e KEY=VAL`, and the `hydris.yml` `env:` block; there is no auto `.env` discovery. Source `<RootDir>/.env` (`ConfigLoader` already exposes `LoadedConfig.RootDir`) via the existing `EnvFile.Parse`, and merge in `TaskRunner.MergeEnv` with lowest precedence (`.env` < hydris.yml `env:` < task `env` < CLI flags). Then consumers like elemix-ssr-benchmarks move `DOTNET_ENVIRONMENT` out of `hydris.yml` into `.env`.
