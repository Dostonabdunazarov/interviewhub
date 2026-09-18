using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NpgsqlTypes;

namespace InterviewHub.Infrastructure.Persistence.Configurations;

public class TheoryTrackConfiguration : IEntityTypeConfiguration<TheoryTrack>
{
    public void Configure(EntityTypeBuilder<TheoryTrack> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Icon).HasMaxLength(64);
        builder.Property(x => x.Color).HasMaxLength(32);

        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => x.SortOrder);
    }
}

public class TheorySectionConfiguration : IEntityTypeConfiguration<TheorySection>
{
    public void Configure(EntityTypeBuilder<TheorySection> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();

        // Уникальность в пределах трека, а не глобально: `postgresql` может
        // встретиться и в dotnet-backend, и в будущем data-engineering.
        builder.HasIndex(x => new { x.TrackId, x.Slug }).IsUnique();
        builder.HasIndex(x => new { x.TrackId, x.SortOrder });

        // Restrict, как Question → Category: удаление трека с разделами
        // не должно молча уносить их каскадом.
        builder.HasOne(x => x.Track)
            .WithMany(x => x.Sections)
            .HasForeignKey(x => x.TrackId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class TheoryArticleConfiguration : IEntityTypeConfiguration<TheoryArticle>
{
    public void Configure(EntityTypeBuilder<TheoryArticle> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(1024);
        builder.Property(x => x.Body).IsRequired();

        // Slug глобально уникален — он в URL.
        builder.HasIndex(x => x.Slug).IsUnique();

        // Основная выборка — статьи раздела по порядку с фильтром видимости.
        builder.HasIndex(x => new { x.SectionId, x.Status, x.SortOrder });

        builder.HasOne(x => x.Section)
            .WithMany(x => x.Articles)
            .HasForeignKey(x => x.SectionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Level)
            .WithMany()
            .HasForeignKey(x => x.LevelId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Полнотекстовый поиск заводим сразу, а не «когда понадобится»:
        // сейчас таблица пустая, а на заполненной миграция с generated-колонкой
        // перепишет её целиком. Ключи те же, что у Question: shadow property,
        // чтобы Domain не зависел от Npgsql, и словарь 'russian'.
        builder.Property<NpgsqlTsVector>("SearchVector")
            .HasComputedColumnSql(
                "to_tsvector('russian', coalesce(\"Title\", '') || ' ' || coalesce(\"Summary\", '') || ' ' || coalesce(\"Body\", ''))",
                stored: true);

        builder.HasIndex("SearchVector").HasMethod("GIN");
    }
}

public class TheoryArticleQuestionConfiguration : IEntityTypeConfiguration<TheoryArticleQuestion>
{
    public void Configure(EntityTypeBuilder<TheoryArticleQuestion> builder)
    {
        builder.HasKey(x => new { x.ArticleId, x.QuestionId });

        // Чистая связь: удаление любой стороны должно убирать её без следа.
        builder.HasOne(x => x.Article)
            .WithMany(x => x.ArticleQuestions)
            .HasForeignKey(x => x.ArticleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Обратный обход — «теория по теме» на странице вопроса.
        builder.HasIndex(x => x.QuestionId);
    }
}
