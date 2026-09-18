using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Level> Levels => Set<Level>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Answer> Answers => Set<Answer>();
    public DbSet<QuestionCompany> QuestionCompanies => Set<QuestionCompany>();
    public DbSet<QuestionTag> QuestionTags => Set<QuestionTag>();
    public DbSet<TheoryTrack> TheoryTracks => Set<TheoryTrack>();
    public DbSet<TheorySection> TheorySections => Set<TheorySection>();
    public DbSet<TheoryArticle> TheoryArticles => Set<TheoryArticle>();
    public DbSet<TheoryArticleQuestion> TheoryArticleQuestions => Set<TheoryArticleQuestion>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        SyncSearchText();
        SyncReadingMinutes();
        return base.SaveChangesAsync(ct);
    }

    public override int SaveChanges()
    {
        SyncSearchText();
        SyncReadingMinutes();
        return base.SaveChanges();
    }

    /// <summary>
    /// Держит Question.SearchText в согласии с текстом ответов, чтобы генерируемый
    /// tsvector покрывал и ответы. Иначе поиск по "ConfigureAwait" не найдёт вопрос,
    /// у которого это слово только в ответе.
    /// </summary>
    private void SyncSearchText()
    {
        var touched = ChangeTracker.Entries<Answer>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(e => e.Entity.QuestionId)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        // Ответы, добавленные через навигацию нового вопроса, ещё не имеют QuestionId.
        foreach (var entry in ChangeTracker.Entries<Question>()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified))
            touched.Add(entry.Entity.Id);

        if (touched.Count == 0) return;

        foreach (var questionId in touched)
        {
            var question = ChangeTracker.Entries<Question>()
                .FirstOrDefault(e => e.Entity.Id == questionId)?.Entity;

            if (question is null) continue;

            // Берём и уже загруженные ответы, и добавляемые в этой транзакции.
            var bodies = ChangeTracker.Entries<Answer>()
                .Where(e => e.State != EntityState.Deleted)
                .Select(e => e.Entity)
                .Where(a => a.QuestionId == questionId || question.Answers.Contains(a))
                .Select(a => a.Body);

            var text = string.Join(' ', bodies).Trim();
            question.SearchText = text.Length == 0 ? null : text;
        }
    }

    /// <summary>
    /// Пересчитывает TheoryArticle.ReadingMinutes по телу статьи. Здесь, а не
    /// в сервисе, по той же причине, что и SearchText: значение обязано быть
    /// согласовано с Body при любом пути записи, включая сидер и импорт.
    /// </summary>
    private void SyncReadingMinutes()
    {
        foreach (var entry in ChangeTracker.Entries<TheoryArticle>()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified))
            entry.Entity.ReadingMinutes = EstimateReadingMinutes(entry.Entity.Body);
    }

    /// <summary>
    /// 200 слов в минуту — общепринятая оценка для технического текста,
    /// минимум 1 минута: «0 мин» в карточке выглядит как ошибка, а не как
    /// короткая статья.
    /// </summary>
    internal static int EstimateReadingMinutes(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return 1;

        var words = 0;
        var inWord = false;

        foreach (var ch in body)
        {
            if (char.IsWhiteSpace(ch))
            {
                inWord = false;
            }
            else if (!inWord)
            {
                inWord = true;
                words++;
            }
        }

        return Math.Max(1, (int)Math.Ceiling(words / 200.0));
    }
}
