using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

public class PrepTopic : BaseEntity
{
    public Guid GuideId { get; set; }
    public PrepGuide Guide { get; set; } = null!;

    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;

    public int SortOrder { get; set; }

    public ICollection<PrepTopicQuestion> Questions { get; set; } = [];
    public ICollection<PrepTopicArticle> Articles { get; set; } = [];
    public ICollection<PrepTopicPuzzle> Puzzles { get; set; } = [];
}

public class PrepTopicQuestion
{
    public Guid TopicId { get; set; }
    public PrepTopic Topic { get; set; } = null!;

    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public int SortOrder { get; set; }
}

public class PrepTopicArticle
{
    public Guid TopicId { get; set; }
    public PrepTopic Topic { get; set; } = null!;

    public Guid TheoryArticleId { get; set; }
    public TheoryArticle TheoryArticle { get; set; } = null!;

    public int SortOrder { get; set; }
}

public class PrepTopicPuzzle
{
    public Guid TopicId { get; set; }
    public PrepTopic Topic { get; set; } = null!;

    public Guid CodePuzzleId { get; set; }
    public CodePuzzle CodePuzzle { get; set; } = null!;

    public int SortOrder { get; set; }
}
