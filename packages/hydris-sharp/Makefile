.DEFAULT_GOAL := run

.PHONY: run run-r kill test watch build release restore clean format format-check

run:
	dotnet run

run-r:
	dotnet run -c Release

kill:
	-pkill -TERM hydris-sharp
	-sleep 1
	-pkill -9 hydris-sharp
	-for p in $$(pgrep bun); do grep -qa hydris-render /proc/$$p/cmdline 2>/dev/null && kill -9 $$p; done
	-rm -f /tmp/hydris-render*.sock /tmp/hydris-render*.ts

test:
	dotnet test Tests/Hydris.Tests.csproj --logger "console;verbosity=detailed"

format:
	dotnet format hydris-sharp.slnx

format-check:
	dotnet format hydris-sharp.slnx --verify-no-changes

watch:
	dotnet watch run

build:
	dotnet build

release:
	dotnet build -c Release

restore:
	dotnet restore

clean:
	dotnet clean
	rm -rf bin obj Hydris/bin Hydris/obj Tests/bin Tests/obj
