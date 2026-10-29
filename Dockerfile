# Build from workspace parent directory so sibling ../Davids.Shared is in build context:
#   docker build -f Davids.Frontend.Admin/Dockerfile -t ghcr.io/davids/davids-frontend-admin:1.0.0 .
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build
WORKDIR /workspace

COPY Davids.Shared/Directory.Build.props Davids.Shared/Directory.Packages.props Davids.Shared/global.json ./Davids.Shared/
COPY Davids.Shared/eng/ ./Davids.Shared/eng/
COPY Davids.Shared/src/Davids.ServiceDefaults/Davids.ServiceDefaults.csproj Davids.Shared/src/Davids.ServiceDefaults/packages.lock.json ./Davids.Shared/src/Davids.ServiceDefaults/
COPY Davids.Frontend.Admin/Directory.Build.props Davids.Frontend.Admin/Directory.Packages.props Davids.Frontend.Admin/global.json ./Davids.Frontend.Admin/
COPY Davids.Frontend.Admin/src/Davids.Frontend.Admin/Davids.Frontend.Admin.csproj Davids.Frontend.Admin/src/Davids.Frontend.Admin/packages.lock.json ./Davids.Frontend.Admin/src/Davids.Frontend.Admin/

RUN dotnet restore ./Davids.Frontend.Admin/src/Davids.Frontend.Admin/Davids.Frontend.Admin.csproj --locked-mode

COPY Davids.Shared/src/Davids.ServiceDefaults/ ./Davids.Shared/src/Davids.ServiceDefaults/
COPY Davids.Frontend.Admin/src/ ./Davids.Frontend.Admin/src/

RUN dotnet publish ./Davids.Frontend.Admin/src/Davids.Frontend.Admin/Davids.Frontend.Admin.csproj \
      --no-restore -c Release /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0

COPY --from=build --chown=10001:10001 /workspace/Davids.Frontend.Admin/artifacts/publish/Davids.Frontend.Admin/release .
USER 10001:10001
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["dotnet", "--info"]

ENTRYPOINT ["dotnet", "Davids.Frontend.Admin.dll"]
