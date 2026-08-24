namespace InterviewHub.Api.Filters;

/// <summary>
/// Имена политик авторизации. Editor правит контент, Admin — ещё и пользователей,
/// поэтому политика Editor включает обе роли, а не только Editor.
/// </summary>
public static class AuthPolicies
{
    public const string Editor = "Editor";
    public const string Admin = "Admin";
}
