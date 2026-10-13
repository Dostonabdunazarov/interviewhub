using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPuzzlesFactsSuggestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CodePuzzles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: false),
                    Difficulty = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ViewCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    LevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodePuzzles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CodePuzzles_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CodePuzzles_Levels_LevelId",
                        column: x => x.LevelId,
                        principalTable: "Levels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CodePuzzles_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DevFacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevFacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DevFacts_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DevFacts_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Suggestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    AnswerDraft = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    Category = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Level = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Company = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Round = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Contact = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TargetType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    TargetSlug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AdminNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suggestions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CodePuzzleOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PuzzleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodePuzzleOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CodePuzzleOptions_CodePuzzles_PuzzleId",
                        column: x => x.PuzzleId,
                        principalTable: "CodePuzzles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CodePuzzleOptions_PuzzleId_SortOrder",
                table: "CodePuzzleOptions",
                columns: new[] { "PuzzleId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CodePuzzles_CategoryId_LevelId_Status",
                table: "CodePuzzles",
                columns: new[] { "CategoryId", "LevelId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CodePuzzles_CreatedByUserId",
                table: "CodePuzzles",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CodePuzzles_LevelId",
                table: "CodePuzzles",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_CodePuzzles_Slug",
                table: "CodePuzzles",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DevFacts_CategoryId",
                table: "DevFacts",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_DevFacts_CreatedByUserId",
                table: "DevFacts",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DevFacts_Slug",
                table: "DevFacts",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DevFacts_Status",
                table: "DevFacts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Suggestions_Status_CreatedAt",
                table: "Suggestions",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CodePuzzleOptions");

            migrationBuilder.DropTable(
                name: "DevFacts");

            migrationBuilder.DropTable(
                name: "Suggestions");

            migrationBuilder.DropTable(
                name: "CodePuzzles");
        }
    }
}
