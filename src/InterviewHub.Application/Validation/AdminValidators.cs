using FluentValidation;
using InterviewHub.Application.Dtos;

namespace InterviewHub.Application.Validation;

/// <summary>
/// Длины строк совпадают с ограничениями EF-конфигураций: без этого слишком длинное
/// значение дошло бы до Postgres и вернулось как 500 вместо внятной 400.
/// Slug не валидируется на формат — он всё равно нормализуется генератором.
/// </summary>
public sealed class QuestionInputValidator : AbstractValidator<QuestionInput>
{
    private const int CurrentYearCeiling = 2100;

    public QuestionInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(512);
        RuleFor(x => x.Slug).MaximumLength(256);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.LevelId).NotEmpty();
        RuleFor(x => x.Difficulty).InclusiveBetween(1, 5);
        RuleFor(x => x.Status).IsInEnum();

        RuleForEach(x => x.Companies!).ChildRules(c =>
        {
            c.RuleFor(x => x.CompanyId).NotEmpty();
            c.RuleFor(x => x.AskedYear).InclusiveBetween(1990, CurrentYearCeiling)
                .When(x => x.AskedYear.HasValue);
            c.RuleFor(x => x.Round).IsInEnum().When(x => x.Round.HasValue);
        }).When(x => x.Companies is not null);

        RuleForEach(x => x.TagIds!).NotEmpty().When(x => x.TagIds is not null);
    }
}

public sealed class AnswerInputValidator : AbstractValidator<AnswerInput>
{
    public AnswerInputValidator()
    {
        RuleFor(x => x.Body).NotEmpty();
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

public sealed class CategoryInputValidator : AbstractValidator<CategoryInput>
{
    public CategoryInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Slug).MaximumLength(64);
        RuleFor(x => x.Description).MaximumLength(512);
        RuleFor(x => x.Icon).MaximumLength(64);
        RuleFor(x => x.Color).MaximumLength(16);
    }
}

public sealed class LevelInputValidator : AbstractValidator<LevelInput>
{
    public LevelInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Slug).MaximumLength(64);
        RuleFor(x => x.Color).MaximumLength(16);
    }
}

public sealed class CompanyInputValidator : AbstractValidator<CompanyInput>
{
    public CompanyInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Slug).MaximumLength(64);
        RuleFor(x => x.LogoUrl).MaximumLength(512);
        RuleFor(x => x.Color).MaximumLength(16);
        RuleFor(x => x.Description).MaximumLength(1024);
        RuleFor(x => x.Country).MaximumLength(64);
    }
}

public sealed class TagInputValidator : AbstractValidator<TagInput>
{
    public TagInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Slug).MaximumLength(64);
    }
}

public sealed class UserInputValidator : AbstractValidator<UserInput>
{
    public UserInputValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Role).IsInEnum();
    }
}

public sealed class UserCreateInputValidator : AbstractValidator<UserCreateInput>
{
    public UserCreateInputValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Role).IsInEnum();
        RuleFor(x => x.Password).SetValidator(new PasswordValidator());
    }
}

public sealed class ChangePasswordInputValidator : AbstractValidator<ChangePasswordInput>
{
    public ChangePasswordInputValidator()
    {
        RuleFor(x => x.NewPassword).SetValidator(new PasswordValidator());
    }
}

/// <summary>
/// Требования к паролю. Заведомо скромные: аккаунты создаёт админ вручную,
/// перебор через API ограничен, а слишком строгие правила гонят пароли в стикеры.
/// </summary>
internal sealed class PasswordValidator : AbstractValidator<string>
{
    public PasswordValidator()
    {
        RuleFor(x => x)
            .NotEmpty().WithMessage("Пароль не может быть пустым.")
            .MinimumLength(8).WithMessage("Пароль должен быть не короче 8 символов.")
            .MaximumLength(128).WithMessage("Пароль должен быть не длиннее 128 символов.")
            .Must(p => p.Any(char.IsLetter) && p.Any(char.IsDigit))
            .WithMessage("Пароль должен содержать буквы и цифры.");
    }
}
