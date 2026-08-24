using System.Text;
using FluentValidation;
using InterviewHub.Api.Endpoints;
using InterviewHub.Api.Filters;
using InterviewHub.Application.Validation;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Auth;
using InterviewHub.Infrastructure.Persistence;
using InterviewHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<AdminBootstrapper>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IQuestionService, QuestionService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IQuestionAdminService, QuestionAdminService>();
builder.Services.AddScoped<ICatalogAdminService, CatalogAdminService>();
builder.Services.AddScoped<IUserAdminService, UserAdminService>();

// Валидаторы админских DTO живут в Application рядом с самими DTO.
builder.Services.AddValidatorsFromAssemblyContaining<QuestionInputValidator>();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
          ?? throw new InvalidOperationException("Секция конфигурации Jwt отсутствует.");

if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key не задан или короче 32 символов. Задайте его через переменные окружения.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// Editor правит контент, Admin — ещё и пользователей, поэтому политика Editor
// пропускает обе роли: иначе админ не смог бы редактировать вопросы.
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthPolicies.Editor, p => p.RequireRole(
        nameof(UserRole.Editor), nameof(UserRole.Admin)))
    .AddPolicy(AuthPolicies.Admin, p => p.RequireRole(nameof(UserRole.Admin)));

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(opt => opt.AddDefaultPolicy(policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!, name: "postgres");

var app = builder.Build();

// Миграции и сидинг при старте: контент наполняет админ, но справочники нужны сразу.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);

    // Демо-вопросы только вне прода: в проде контент наполняет админ.
    if (app.Environment.IsDevelopment())
        await DemoContent.SeedAsync(db);

    await scope.ServiceProvider.GetRequiredService<AdminBootstrapper>().EnsureAdminAsync();
}

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseSerilogRequestLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapPublicEndpoints();
app.MapAuthEndpoints();
app.MapAdminEndpoints();

app.Run();
