using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrepGuides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PrepGuides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Role = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RoleName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    LevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Intro = table.Column<string>(type: "text", nullable: false),
                    InterviewFormat = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrepGuides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrepGuides_Levels_LevelId",
                        column: x => x.LevelId,
                        principalTable: "Levels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PrepTopics",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GuideId = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrepTopics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrepTopics_PrepGuides_GuideId",
                        column: x => x.GuideId,
                        principalTable: "PrepGuides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PrepTopicArticles",
                columns: table => new
                {
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    TheoryArticleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrepTopicArticles", x => new { x.TopicId, x.TheoryArticleId });
                    table.ForeignKey(
                        name: "FK_PrepTopicArticles_PrepTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "PrepTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PrepTopicArticles_TheoryArticles_TheoryArticleId",
                        column: x => x.TheoryArticleId,
                        principalTable: "TheoryArticles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PrepTopicPuzzles",
                columns: table => new
                {
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodePuzzleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrepTopicPuzzles", x => new { x.TopicId, x.CodePuzzleId });
                    table.ForeignKey(
                        name: "FK_PrepTopicPuzzles_CodePuzzles_CodePuzzleId",
                        column: x => x.CodePuzzleId,
                        principalTable: "CodePuzzles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PrepTopicPuzzles_PrepTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "PrepTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PrepTopicQuestions",
                columns: table => new
                {
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrepTopicQuestions", x => new { x.TopicId, x.QuestionId });
                    table.ForeignKey(
                        name: "FK_PrepTopicQuestions_PrepTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "PrepTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PrepTopicQuestions_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PrepGuides_LevelId",
                table: "PrepGuides",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_PrepGuides_Slug",
                table: "PrepGuides",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrepGuides_Status_Role_SortOrder",
                table: "PrepGuides",
                columns: new[] { "Status", "Role", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_PrepTopicArticles_TheoryArticleId",
                table: "PrepTopicArticles",
                column: "TheoryArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_PrepTopicPuzzles_CodePuzzleId",
                table: "PrepTopicPuzzles",
                column: "CodePuzzleId");

            migrationBuilder.CreateIndex(
                name: "IX_PrepTopicQuestions_QuestionId",
                table: "PrepTopicQuestions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_PrepTopics_GuideId_Slug",
                table: "PrepTopics",
                columns: new[] { "GuideId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrepTopics_GuideId_SortOrder",
                table: "PrepTopics",
                columns: new[] { "GuideId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PrepTopicArticles");

            migrationBuilder.DropTable(
                name: "PrepTopicPuzzles");

            migrationBuilder.DropTable(
                name: "PrepTopicQuestions");

            migrationBuilder.DropTable(
                name: "PrepTopics");

            migrationBuilder.DropTable(
                name: "PrepGuides");
        }
    }
}
