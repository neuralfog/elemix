.DEFAULT_GOAL := build

.PHONY: test lint-fix lint build buildr restore clean bench build-native

test:
	dotnet test hydris.slnx --logger "console;verbosity=detailed"

lint-fix:
	dotnet format hydris.slnx

lint:
	dotnet format hydris.slnx --verify-no-changes

build:
	dotnet build

buildr:
	dotnet build -c Release

restore:
	dotnet restore

clean:
	dotnet clean
	rm -rf bin obj Hydris/bin Hydris/obj Tests/bin Tests/obj

bench:
# 	wrk -t12 -c400 -d10s -H 'Accept-Encoding: br,gzip' http://127.0.0.1:5000/test-render
# 	wrk -t12 -c400 -d10s http://localhost:5000/test-render
	wrk -t12 -c400 -d10s http://localhost:5000/lorem-1k
# 	wrk -t12 -c400 -d10s http://localhost:3000/lorem-1k

build-native:
	bash Hydris.QuickJs/native/build.sh
