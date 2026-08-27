FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends clang zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY Hydris/ Hydris/
COPY Hydris.Generators/ Hydris.Generators/
COPY tests/aot-smoke/ tests/aot-smoke/

RUN dotnet publish tests/aot-smoke/AotSmoke.csproj -c Release -r linux-x64 -o /app

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0 AS run

WORKDIR /app

COPY --from=build /app/AotSmoke ./AotSmoke

ENV HYDRIS_HOST=0.0.0.0 SIDECARS=0 DOTNET_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["./AotSmoke"]
