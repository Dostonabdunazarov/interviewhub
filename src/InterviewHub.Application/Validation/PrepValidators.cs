using System.Text.RegularExpressions;
using FluentValidation;
using InterviewHub.Application.Dtos;

namespace InterviewHub.Application.Validation;

public sealed partial class PrepGuideInputValidator : AbstractValidator<PrepGuideInput>
{
    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();

    private const string SlugMessage = "Slug: строчные латинские буквы, цифры и дефисы.";

    public PrepGuideInputValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(256).Matches(SlugPattern()).WithMessage(SlugMessage);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(512);
        RuleFor(x => x.Role).NotEmpty().MaximumLength(64).Matches(SlugPattern()).WithMessage(SlugMessage);
        RuleFor(x => x.RoleName).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Level).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Summary).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Intro).NotEmpty();
        RuleFor(x => x.InterviewFormat).NotEmpty();

        RuleFor(x => x.Topics)
            .Cascade(CascadeMode.Stop)
            .NotNull()
            .NotEmpty().WithMessage("Нужна хотя бы одна тема.")
            .Must(t => t.All(x => x is not null))
            .WithMessage("Тема не может быть пустой.")
            .Must(t => t.Select(x => x.Slug).Distinct(StringComparer.Ordinal).Count() == t.Count)
            .WithMessage("Slug тем должны быть уникальны в пределах гайда.");

        RuleForEach(x => x.Topics).ChildRules(t =>
        {
            t.RuleFor(x => x.Slug).NotEmpty().MaximumLength(256).Matches(SlugPattern()).WithMessage(SlugMessage);
            t.RuleFor(x => x.Title).NotEmpty().MaximumLength(512);
            t.RuleFor(x => x.Body).NotEmpty();
            t.RuleForEach(x => x.Questions).NotEmpty();
            t.RuleForEach(x => x.Articles).NotEmpty();
            t.RuleForEach(x => x.Puzzles).NotEmpty();
        }).When(x => x.Topics is not null);
    }
}
