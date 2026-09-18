/**
 * Импорт статей теории из Markdown в InterviewHub через админ-API.
 *
 * Идёт через HTTP, а не напрямую в БД, по тем же причинам, что и
 * import-questions.mjs: работают серверная валидация и генерация slug,
 * ReadingMinutes считается в SaveChangesAsync, а кэш публичного дерева
 * сбрасывается сразу. Прямой SQL всё это обходит — статья появилась бы
 * на сайте только через 15 минут и с нулевым временем чтения.
 *
 * Запуск:
 *   node tools/import-theory.mjs --url https://interview.hypex.site \
 *        --email admin@example.com --password '…' \
 *        --dir content/theory/csharp-lang
 *
 * Пароль можно не передавать флагом, а положить в IH_ADMIN_PASSWORD —
 * флаг виден в списке процессов и остаётся в history шелла.
 *
 * Флаги:
 *   --dry-run    разобрать файлы и показать план, ничего не отправляя
 *   --update     обновлять статью, если slug уже есть (по умолчанию пропускать)
 *   --publish    ставить статус «Опубликована» (по умолчанию «Черновик»)
 *
 * Зависимостей нет: fetch и парсер встроены. Node 18+.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

// --- Разбор аргументов ------------------------------------------------------

function parseArgs(argv) {
  const args = { dir: "content/theory/csharp-lang", dryRun: false, update: false, publish: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--update") args.update = true;
    else if (a === "--publish") args.publish = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--password") args.password = argv[++i];
    else if (a === "--dir") args.dir = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  args.password ??= process.env.IH_ADMIN_PASSWORD;
  args.url ??= process.env.IH_API_URL;
  args.email ??= process.env.IH_ADMIN_EMAIL;
  return args;
}

const HELP = `
Импорт статей теории из Markdown через админ-API.

  node tools/import-theory.mjs --url <api> --email <admin> [--password <pwd>] [флаги]

Флаги:
  --dir <path>   каталог со статьями (по умолчанию content/theory/csharp-lang)
  --dry-run      показать план, ничего не отправляя
  --update       обновлять статью, если slug уже есть
  --publish      статус «Опубликована» вместо «Черновик»

Переменные окружения: IH_API_URL, IH_ADMIN_EMAIL, IH_ADMIN_PASSWORD.

Формат файла: YAML-фронтматтер и тело в Markdown.

  ---
  title: Value type и reference type: в чём разница
  slug: value-type-i-reference-type
  track: dotnet-backend
  section: csharp-lang
  level: middle
  sortOrder: 1
  summary: Короткий анонс для карточки и meta description.
  ---

  ## Первый заголовок

  Текст статьи…
`;

// --- Фронтматтер ------------------------------------------------------------

/**
 * Минимальный разбор YAML-фронтматтера: только плоские пары «ключ: значение».
 * Полноценный YAML здесь не нужен, а тянуть зависимость ради пяти полей —
 * лишнее. Значение берётся до конца строки, поэтому двоеточия внутри
 * заголовка («record: что выбрать») не ломают разбор.
 */
function parseFrontmatter(raw, file) {
  if (!raw.startsWith("---")) {
    throw new Error(`${file}: нет фронтматтера — файл должен начинаться с «---»`);
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error(`${file}: фронтматтер не закрыт «---»`);

  const head = raw.slice(3, end);
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");

  const meta = {};
  for (const line of head.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colon = trimmed.indexOf(":");
    if (colon === -1) throw new Error(`${file}: строка фронтматтера без «:» — ${trimmed}`);

    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();

    // Кавычки нужны только чтобы сохранить ведущие пробелы — снимаем их.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  for (const required of ["title", "track", "section"]) {
    if (!meta[required]) throw new Error(`${file}: во фронтматтере нет «${required}»`);
  }

  if (!body.trim()) throw new Error(`${file}: пустое тело статьи`);

  return { meta, body: body.trim() };
}

// --- HTTP-клиент ------------------------------------------------------------

class Api {
  constructor(baseUrl) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.token = null;
  }

  async call(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text;
      try {
        const j = JSON.parse(text);
        detail = j.detail ?? j.title ?? JSON.stringify(j.errors ?? j);
      } catch { /* не JSON — печатаем как есть */ }
      throw new Error(`${method} ${path} → ${res.status}: ${String(detail).slice(0, 400)}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  get = (p) => this.call("GET", p);
  post = (p, b) => this.call("POST", p, b);
  put = (p, b) => this.call("PUT", p, b);

  async login(email, password) {
    const auth = await this.call("POST", "/api/auth/login", { email, password });
    this.token = auth.accessToken;
    return auth.user;
  }
}

// --- Основной сценарий ------------------------------------------------------

const TheoryStatus = { Draft: 1, Published: 2 };

async function loadArticles(dir) {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort();

  if (files.length === 0) throw new Error(`В каталоге ${dir} нет .md-файлов`);

  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(dir, file), "utf8");
      const { meta, body } = parseFrontmatter(raw, file);
      return { file, meta, body };
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return;
  }

  const articles = await loadArticles(args.dir);

  if (args.dryRun) {
    console.log(`Каталог: ${args.dir}\nСтатей: ${articles.length}\n`);
    for (const { file, meta, body } of articles) {
      const words = body.split(/\s+/).filter(Boolean).length;
      console.log(
        `  ${file}\n` +
          `    ${meta.title}\n` +
          `    slug=${meta.slug ?? "(из заголовка)"} ` +
          `${meta.track}/${meta.section} level=${meta.level ?? "—"} ` +
          `order=${meta.sortOrder ?? 0} ≈${Math.max(1, Math.ceil(words / 200))} мин\n`,
      );
    }
    console.log("Это dry-run: ничего не отправлено.");
    return;
  }

  if (!args.url || !args.email || !args.password) {
    throw new Error("Нужны --url, --email и пароль (--password или IH_ADMIN_PASSWORD).");
  }

  const api = new Api(args.url);
  const user = await api.login(args.email, args.password);
  console.log(`Вход: ${user.displayName} (${user.email})\n`);

  // Дерево и грейды тянем один раз: они общие для всех статей.
  const tree = await api.get("/api/admin/theory/tree");
  const levels = await api.get("/api/admin/levels");
  const levelBySlug = new Map(levels.map((l) => [l.slug, l.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { file, meta, body } of articles) {
    const track = tree.find((t) => t.slug === meta.track);
    if (!track) throw new Error(`${file}: трека «${meta.track}» нет в базе`);

    const section = track.sections.find((s) => s.slug === meta.section);
    if (!section) throw new Error(`${file}: в треке «${meta.track}» нет раздела «${meta.section}»`);

    if (meta.level && !levelBySlug.has(meta.level)) {
      throw new Error(`${file}: грейда «${meta.level}» нет в справочнике`);
    }

    const payload = {
      title: meta.title,
      slug: meta.slug ?? null,
      summary: meta.summary ?? null,
      body,
      sortOrder: Number(meta.sortOrder ?? 0),
      status: args.publish ? TheoryStatus.Published : TheoryStatus.Draft,
      sectionId: section.id,
      levelId: meta.level ? levelBySlug.get(meta.level) : null,
      // Привязки к вопросам не трогаем: их расставляют руками в админке,
      // и импорт не должен их стирать при обновлении.
      questionIds: undefined,
    };

    const existing = meta.slug
      ? (await api.get(`/api/admin/theory/articles?sectionId=${section.id}`)).find(
          (a) => a.slug === meta.slug,
        )
      : null;

    if (existing && !args.update) {
      console.log(`  ~ ${meta.slug} — уже есть, пропущено (--update чтобы обновить)`);
      skipped++;
      continue;
    }

    if (existing) {
      // При обновлении сохраняем уже проставленные привязки к вопросам.
      const full = await api.get(`/api/admin/theory/articles/${existing.id}`);
      const result = await api.put(`/api/admin/theory/articles/${existing.id}`, {
        ...payload,
        questionIds: full.relatedQuestions.map((q) => q.id),
      });
      console.log(`  ↻ ${result.slug} — обновлена, ${result.readingMinutes} мин`);
      updated++;
    } else {
      const result = await api.post("/api/admin/theory/articles", {
        ...payload,
        questionIds: [],
      });
      console.log(`  + ${result.slug} — создана, ${result.readingMinutes} мин`);
      created++;
    }
  }

  console.log(
    `\nСоздано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.` +
      (args.publish ? "" : "\nСтатус — «Черновик»: гостям не видны до публикации."),
  );
}

main().catch((e) => {
  console.error(`\nОшибка: ${e.message}`);
  process.exit(1);
});
