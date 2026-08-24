using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NpgsqlTypes;

namespace InterviewHub.Infrastructure.Persistence.Configurations;

public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();

        builder.HasIndex(x => x.Slug).IsUnique();

        // Основной фильтр каталога — категория + грейд + видимость.
        builder.HasIndex(x => new { x.CategoryId, x.LevelId, x.Status });

        builder.HasOne(x => x.Category)
            .WithMany(x => x.Questions)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Level)
            .WithMany(x => x.Questions)
            .HasForeignKey(x => x.LevelId)
            .OnDelete(DeleteBehavior.Restrict);

        // Автор — справочная связь: удаление пользователя не должно удалять контент.
        builder.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Полнотекстовый поиск: генерируемая Postgres колонка tsvector по заголовку и телу.
        // Объявлена shadow property, а не полем сущности, чтобы Domain не зависел от Npgsql.
        // 'russian' покрывает и латиницу, так что подходит для смешанного контента.
        builder.Property<NpgsqlTsVector>("SearchVector")
            .HasComputedColumnSql(
                "to_tsvector('russian', coalesce(\"Title\", '') || ' ' || coalesce(\"Body\", '') || ' ' || coalesce(\"SearchText\", ''))",
                stored: true);

        builder.HasIndex("SearchVector").HasMethod("GIN");
    }
}

public class AnswerConfiguration : IEntityTypeConfiguration<Answer>
{
    public void Configure(EntityTypeBuilder<Answer> builder)
    {
        builder.Property(x => x.Body).IsRequired();

        builder.HasOne(x => x.Question)
            .WithMany(x => x.Answers)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.QuestionId, x.SortOrder });
    }
}

public class QuestionCompanyConfiguration : IEntityTypeConfiguration<QuestionCompany>
{
    public void Configure(EntityTypeBuilder<QuestionCompany> builder)
    {
        builder.HasKey(x => new { x.QuestionId, x.CompanyId });

        builder.HasOne(x => x.Question)
            .WithMany(x => x.QuestionCompanies)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Company)
            .WithMany(x => x.QuestionCompanies)
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.CompanyId);
    }
}

public class QuestionTagConfiguration : IEntityTypeConfiguration<QuestionTag>
{
    public void Configure(EntityTypeBuilder<QuestionTag> builder)
    {
        builder.HasKey(x => new { x.QuestionId, x.TagId });

        builder.HasOne(x => x.Question)
            .WithMany(x => x.QuestionTags)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Tag)
            .WithMany(x => x.QuestionTags)
            .HasForeignKey(x => x.TagId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.TagId);
    }
}
