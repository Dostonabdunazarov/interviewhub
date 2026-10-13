using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InterviewHub.Infrastructure.Persistence.Configurations;

public class CodePuzzleConfiguration : IEntityTypeConfiguration<CodePuzzle>
{
    public void Configure(EntityTypeBuilder<CodePuzzle> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Body).IsRequired();
        builder.Property(x => x.Explanation).IsRequired();

        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => new { x.CategoryId, x.LevelId, x.Status });

        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Level)
            .WithMany()
            .HasForeignKey(x => x.LevelId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class CodePuzzleOptionConfiguration : IEntityTypeConfiguration<CodePuzzleOption>
{
    public void Configure(EntityTypeBuilder<CodePuzzleOption> builder)
    {
        builder.Property(x => x.Text).HasMaxLength(1024).IsRequired();

        builder.HasOne(x => x.Puzzle)
            .WithMany(x => x.Options)
            .HasForeignKey(x => x.PuzzleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.PuzzleId, x.SortOrder });
    }
}

public class DevFactConfiguration : IEntityTypeConfiguration<DevFact>
{
    public void Configure(EntityTypeBuilder<DevFact> builder)
    {
        builder.Property(x => x.Slug).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Body).IsRequired();

        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SuggestionConfiguration : IEntityTypeConfiguration<Suggestion>
{
    public void Configure(EntityTypeBuilder<Suggestion> builder)
    {
        builder.Property(x => x.Text).HasMaxLength(5000).IsRequired();
        builder.Property(x => x.AnswerDraft).HasMaxLength(20000);
        builder.Property(x => x.Category).HasMaxLength(128);
        builder.Property(x => x.Level).HasMaxLength(64);
        builder.Property(x => x.Company).HasMaxLength(128);
        builder.Property(x => x.Round).HasMaxLength(64);
        builder.Property(x => x.Contact).HasMaxLength(256);
        builder.Property(x => x.TargetType).HasMaxLength(32);
        builder.Property(x => x.TargetSlug).HasMaxLength(256);
        builder.Property(x => x.AdminNote).HasMaxLength(2000);

        builder.HasIndex(x => new { x.Status, x.CreatedAt });
    }
}
