# Сборка API. Запускать из корня репозитория:
#   docker build -f src/InterviewHub.Api/Dockerfile -t interviewhub-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Сначала только манифесты — слой с restore переиспользуется,
# пока не менялись .csproj, а не при каждой правке кода.
COPY *.slnx ./
COPY src/InterviewHub.Domain/InterviewHub.Domain.csproj src/InterviewHub.Domain/
COPY src/InterviewHub.Application/InterviewHub.Application.csproj src/InterviewHub.Application/
COPY src/InterviewHub.Infrastructure/InterviewHub.Infrastructure.csproj src/InterviewHub.Infrastructure/
COPY src/InterviewHub.Api/InterviewHub.Api.csproj src/InterviewHub.Api/
RUN dotnet restore src/InterviewHub.Api/InterviewHub.Api.csproj

COPY src/ src/
RUN dotnet publish src/InterviewHub.Api/InterviewHub.Api.csproj \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Непривилегированный пользователь: образы .NET уже содержат UID 1654 "app".
USER $APP_UID

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "InterviewHub.Api.dll"]
