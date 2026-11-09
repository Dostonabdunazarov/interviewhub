using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InterviewHub.Infrastructure.Persistence.Configurations;

public class PrepGuideConfiguration : IEntityTypeConfiguration<PrepGuide>
{
    public void Configure(EntityTypeBuilder<PrepGuide> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Role).HasMaxLength(64).IsRequired();
        builder.Property(x => x.RoleName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.Intro).IsRequired();
        builder.Property(x => x.InterviewFormat).IsRequired();

        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => new { x.Status, x.Role, x.SortOrder });

        builder.HasOne(x => x.Level)
            .WithMany()
            .HasForeignKey(x => x.LevelId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PrepTopicConfiguration : IEntityTypeConfiguration<PrepTopic>
{
    public void Configure(EntityTypeBuilder<PrepTopic> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Body).IsRequired();

        builder.HasIndex(x => new { x.GuideId, x.Slug }).IsUnique();
        builder.HasIndex(x => new { x.GuideId, x.SortOrder });

        builder.HasOne(x => x.Guide)
            .WithMany(x => x.Topics)
            .HasForeignKey(x => x.GuideId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PrepTopicQuestionConfiguration : IEntityTypeConfiguration<PrepTopicQuestion>
{
    public void Configure(EntityTypeBuilder<PrepTopicQuestion> builder)
    {
        builder.HasKey(x => new { x.TopicId, x.QuestionId });

        builder.HasOne(x => x.Topic)
            .WithMany(x => x.Questions)
            .HasForeignKey(x => x.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.QuestionId);
    }
}

public class PrepTopicArticleConfiguration : IEntityTypeConfiguration<PrepTopicArticle>
{
    public void Configure(EntityTypeBuilder<PrepTopicArticle> builder)
    {
        builder.HasKey(x => new { x.TopicId, x.TheoryArticleId });

        builder.HasOne(x => x.Topic)
            .WithMany(x => x.Articles)
            .HasForeignKey(x => x.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.TheoryArticle)
            .WithMany()
            .HasForeignKey(x => x.TheoryArticleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.TheoryArticleId);
    }
}

public class PrepTopicPuzzleConfiguration : IEntityTypeConfiguration<PrepTopicPuzzle>
{
    public void Configure(EntityTypeBuilder<PrepTopicPuzzle> builder)
    {
        builder.HasKey(x => new { x.TopicId, x.CodePuzzleId });

        builder.HasOne(x => x.Topic)
            .WithMany(x => x.Puzzles)
            .HasForeignKey(x => x.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.CodePuzzle)
            .WithMany()
            .HasForeignKey(x => x.CodePuzzleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.CodePuzzleId);
    }
}
