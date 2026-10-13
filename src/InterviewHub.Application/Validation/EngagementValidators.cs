using FluentValidation;
using InterviewHub.Application.Dtos;

namespace InterviewHub.Application.Validation;

public sealed class PuzzleInputValidator : AbstractValidator<PuzzleInput>
{
    public const int OptionCount = 4;

    public PuzzleInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(512);
        RuleFor(x => x.Slug).MaximumLength(256);
        RuleFor(x => x.Kind).IsInEnum();
        RuleFor(x => x.Body).NotEmpty();
        RuleFor(x => x.Explanation).NotEmpty();
        RuleFor(x => x.Difficulty).InclusiveBetween(1, 5);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.LevelId).NotEmpty();

        RuleFor(x => x.Options)
            .NotNull()
            .Must(o => o.Count == OptionCount)
            .WithMessage($"Нужно ровно {OptionCount} варианта ответа.")
            .Must(o => o.Count(x => x.IsCorrect) == 1)
            .WithMessage("Верным должен быть ровно один вариант.");

        RuleForEach(x => x.Options).ChildRules(o =>
            o.RuleFor(x => x.Text).NotEmpty().MaximumLength(1024));
    }
}

public sealed class FactInputValidator : AbstractValidator<FactInput>
{
    public FactInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(512);
        RuleFor(x => x.Slug).MaximumLength(256);
        RuleFor(x => x.Body).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.Status).IsInEnum();
    }
}

public sealed class SuggestionInputValidator : AbstractValidator<SuggestionInput>
{
    private static readonly string[] TargetTypes = ["question", "article", "puzzle", "fact"];

    public SuggestionInputValidator()
    {
        RuleFor(x => x.Kind).IsInEnum();
        RuleFor(x => x.Text).NotEmpty().MinimumLength(10).MaximumLength(5000);
        RuleFor(x => x.AnswerDraft).MaximumLength(20000);
        RuleFor(x => x.Category).MaximumLength(128);
        RuleFor(x => x.Level).MaximumLength(64);
        RuleFor(x => x.Company).MaximumLength(128);
        RuleFor(x => x.Round).MaximumLength(64);
        RuleFor(x => x.Contact).MaximumLength(256);
        RuleFor(x => x.TargetSlug).MaximumLength(256);
        RuleFor(x => x.TargetType)
            .Must(t => t is null || TargetTypes.Contains(t))
            .WithMessage("Неизвестный тип материала.");
    }
}

public sealed class SuggestionUpdateInputValidator : AbstractValidator<SuggestionUpdateInput>
{
    public SuggestionUpdateInputValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.AdminNote).MaximumLength(2000);
    }
}
