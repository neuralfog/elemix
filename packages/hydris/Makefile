.DEFAULT_GOAL := run

.PHONY: run run-r test lint-fix lint build buildr builda aot run-aot restore clean bench build-native

run:
	DOTNET_PROCESSOR_COUNT=1 dotnet run --project Example

run-r:
	dotnet run --project Example -c Release

test:
	dotnet test Tests/Hydris.Tests.csproj --logger "console;verbosity=detailed"

lint-fix:
	dotnet format hydris.slnx

lint:
	dotnet format hydris.slnx --verify-no-changes

build:
	dotnet build

buildr:
	dotnet build -c Release

builda:
	dotnet run --project Hydris.Build -- Example -O

aot:
	dotnet publish Example -c Release -r linux-x64 -o Example/bin/aot

run-aot:
	DOTNET_PROCESSOR_COUNT=1 taskset -c 0 ./Example/bin/aot/hydris-example
# 	./Example/bin/aot/hydris-example	

restore:
	dotnet restore

clean:
	dotnet clean
	rm -rf bin obj Hydris/bin Hydris/obj Tests/bin Tests/obj

bench:
# 	wrk -t12 -c400 -d10s -H 'Accept-Encoding: br,gzip' http://127.0.0.1:5000/test-render
# 	wrk -t12 -c400 -d10s http://localhost:5000/test-render
	wrk -t12 -c400 -d10s http://localhost:5000/lorem-1k

build-native:
	bash Hydris.QuickJs/native/build.sh
