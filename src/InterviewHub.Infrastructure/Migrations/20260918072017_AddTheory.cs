using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace InterviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTheory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TheoryTracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Color = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TheoryTracks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TheorySections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TheorySections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TheorySections_TheoryTracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "TheoryTracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TheoryArticles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Summary = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    Body = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReadingMinutes = table.Column<int>(type: "integer", nullable: false),
                    ViewCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    LevelId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SearchVector = table.Column<NpgsqlTsVector>(type: "tsvector", nullable: true, computedColumnSql: "to_tsvector('russian', coalesce(\"Title\", '') || ' ' || coalesce(\"Summary\", '') || ' ' || coalesce(\"Body\", ''))", stored: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TheoryArticles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TheoryArticles_Levels_LevelId",
                        column: x => x.LevelId,
                        principalTable: "Levels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TheoryArticles_TheorySections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "TheorySections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TheoryArticles_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TheoryArticleQuestions",
                columns: table => new
                {
                    ArticleId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TheoryArticleQuestions", x => new { x.ArticleId, x.QuestionId });
                    table.ForeignKey(
                        name: "FK_TheoryArticleQuestions_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TheoryArticleQuestions_TheoryArticles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "TheoryArticles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticleQuestions_QuestionId",
                table: "TheoryArticleQuestions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticles_CreatedByUserId",
                table: "TheoryArticles",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticles_LevelId",
                table: "TheoryArticles",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticles_SearchVector",
                table: "TheoryArticles",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticles_SectionId_Status_SortOrder",
                table: "TheoryArticles",
                columns: new[] { "SectionId", "Status", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_TheoryArticles_Slug",
                table: "TheoryArticles",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TheorySections_TrackId_Slug",
                table: "TheorySections",
                columns: new[] { "TrackId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TheorySections_TrackId_SortOrder",
                table: "TheorySections",
                columns: new[] { "TrackId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_TheoryTracks_Slug",
                table: "TheoryTracks",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TheoryTracks_SortOrder",
                table: "TheoryTracks",
                column: "SortOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TheoryArticleQuestions");

            migrationBuilder.DropTable(
                name: "TheoryArticles");

            migrationBuilder.DropTable(
                name: "TheorySections");

            migrationBuilder.DropTable(
                name: "TheoryTracks");
        }
    }
}
