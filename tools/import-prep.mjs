/**
 * Импорт гайдов по подготовке к собеседованию из Markdown в InterviewHub
 * через админ-API (PUT /api/admin/prep, идемпотентный upsert по slug).
 *
 * Запуск:
 *   node tools/import-prep.mjs --url https://interview.hypex.site \
 *        --email admin@example.com --password '…'
 *
 * Пароль можно не передавать флагом, а положить в IH_ADMIN_PASSWORD.
 *
 * Флаги:
 *   --file <path>  импортировать один файл (по умолчанию все content/prep/*.md)
 *   --dry-run      разобрать файлы, проверить ссылки на локальные
 *                  вопросы/статьи/задачи, ничего не отправляя (сеть не нужна)
 *   --publish      статус «Опубликован» (по умолчанию «Черновик»)
 *
 * Зависимостей нет: fetch и парсер встроены. Node 18+.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

function parseArgs(argv) {
  const args = { dryRun: false, publish: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--publish") args.publish = true;
    else if (a === "--file") {
      args.file = argv[++i];
      if (!args.file) throw new Error("--file требует путь к файлу");
    }
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--password") args.password = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  args.password ??= process.env.IH_ADMIN_PASSWORD;
  args.url ??= process.env.IH_API_URL;
  args.email ??= process.env.IH_ADMIN_EMAIL;
  return args;
}

const HELP = `
Импорт гайдов по подготовке к собеседованию (content/prep) через админ-API.

  node tools/import-prep.mjs --url <api> --email <admin> [--password <pwd>] [флаги]

Флаги:
  --file <path>  один файл (по умолчанию все content/prep/*.md)
  --dry-run      проверить файлы и ссылки на вопросы/статьи/задачи, ничего не отправляя
  --publish      статус «Опубликован» вместо «Черновик»

Переменные окружения: IH_API_URL, IH_ADMIN_EMAIL, IH_ADMIN_PASSWORD.

Формат файла:

  ---
  title: Backend .NET: middle
  slug: backend-middle
  role: backend
  roleName: Backend .NET
  level: middle
  sortOrder: 1
  summary: Короткий анонс.
  ---

  # Вступление

  Текст…

  # Формат собеседования

  Текст…

  ## Заголовок темы

  \`\`\`yaml
  slug: topic-slug
  questions: slug-a, slug-b
  articles: slug-c
  puzzles:
  \`\`\`

  Тело темы до следующего «##»…
`;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STATUS_NAMES = { 1: "Черновик", 2: "Опубликован", 3: "Архив" };
const REQUIRED = ["title", "slug", "role", "roleName", "level", "sortOrder", "summary"];

function mask(src) {
  const lines = src.split("\n");
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence === null) {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
        fence = { ch: m[1][0], len: m[1].length };
        lines[i] = line.replace(/[^\r]/g, " ");
      }
    } else {
      const m = line.match(/^ {0,3}(`+|~+)[ \t\r]*$/);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len) fence = null;
      lines[i] = line.replace(/[^\r]/g, " ");
    }
  }
  return lines.join("\n");
}

function parseFrontmatter(raw, file) {
  if (!raw.startsWith("---")) {
    throw new Error(`${file}: нет фронтматтера — файл должен начинаться с «---»`);
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error(`${file}: фронтматтер не закрыт «---»`);

  const head = raw.slice(3, end);
  const body = raw.slice(end + 4).replace(/^\n/, "");

  const meta = {};
  for (const line of head.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) throw new Error(`${file}: строка фронтматтера без «:» — ${trimmed}`);
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body };
}

function parseYamlBlock(block, where) {
  const meta = {};
  for (const raw of block.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) throw new Error(`${where}: строка метаданных без «:» — «${line}»`);
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return meta;
}

function toList(value) {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function parseGuide(raw, file) {
  const src = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const { meta, body } = parseFrontmatter(src, file);

  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${file}: во фронтматтере нет «${key}»`);
  }
  if (!/^-?\d+$/.test(meta.sortOrder)) throw new Error(`${file}: sortOrder должен быть целым числом`);
  const sortOrder = Number(meta.sortOrder);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -2147483648 || sortOrder > 2147483647) throw new Error(`${file}: sortOrder вне диапазона int32`);
  for (const key of ["slug", "role"]) {
    if (!SLUG_RE.test(meta[key])) throw new Error(`${file}: «${key}» должен быть вида a-b-c (латиница, цифры, дефис)`);
  }

  const masked = mask(body);
  const lineOf = (pos) => src.slice(0, src.length - body.length).split("\n").length + body.slice(0, pos).split("\n").length - 1;

  const h1 = [];
  const re1 = /^# +(.+?)[ \t]*$/gm;
  let m;
  while ((m = re1.exec(masked)) !== null) {
    h1.push({ title: m[1].trim(), start: m.index, bodyStart: re1.lastIndex });
  }

  const introIdx = h1.findIndex((h) => h.title.toLowerCase() === "вступление");
  const formatIdx = h1.findIndex((h) => h.title.toLowerCase() === "формат собеседования");
  if (introIdx < 0) throw new Error(`${file}: нет раздела «# Вступление»`);
  if (formatIdx < 0) throw new Error(`${file}: нет раздела «# Формат собеседования»`);

  const sectionEnd = (idx) => (idx + 1 < h1.length ? h1[idx + 1].start : body.length);

  const intro = body.slice(h1[introIdx].bodyStart, sectionEnd(introIdx)).trim();

  const fmt = h1[formatIdx];
  const h2 = [];
  const re2 = /^## +(.+?)[ \t]*$/gm;
  while ((m = re2.exec(masked)) !== null) {
    if (m.index > fmt.start) h2.push({ title: m[1].trim(), start: m.index, bodyStart: re2.lastIndex });
  }

  const fmtEnd = Math.min(sectionEnd(formatIdx), h2.length > 0 ? h2[0].start : Infinity);
  const interviewFormat = body.slice(fmt.bodyStart, fmtEnd).trim();

  if (!intro) throw new Error(`${file}: пустое «Вступление»`);
  if (!interviewFormat) throw new Error(`${file}: пустой «Формат собеседования»`);
  if (h2.length === 0) throw new Error(`${file}: нет ни одной темы («## Заголовок»)`);

  const topics = h2.map((h, i) => {
    const end = i + 1 < h2.length ? h2[i + 1].start : body.length;
    const rawTopic = body.slice(h.bodyStart, end);
    const where = `${file}:${lineOf(h.start)} («${h.title}»)`;

    const yaml = rawTopic.match(/^\s*```ya?ml\s*\n([\s\S]*?)\n\s*```/);
    if (!yaml) throw new Error(`${where}: нет yaml-блока с метаданными темы`);
    const tm = parseYamlBlock(yaml[1], where);
    if (!tm.slug) throw new Error(`${where}: не указано «slug»`);
    if (!SLUG_RE.test(tm.slug)) throw new Error(`${where}: slug «${tm.slug}» должен быть вида a-b-c`);
    const topicBody = rawTopic.slice(yaml.index + yaml[0].length).replace(/\n---\s*$/, "").trim();
    if (!topicBody) throw new Error(`${where}: пустое тело темы`);

    return {
      where,
      title: h.title,
      slug: tm.slug,
      body: topicBody,
      questions: toList(tm.questions),
      articles: toList(tm.articles),
      puzzles: toList(tm.puzzles),
    };
  });

  const topicSlugs = new Map();
  const questionSeen = new Map();
  const errors = [];
  for (const t of topics) {
    if (topicSlugs.has(t.slug)) errors.push(`${t.where}: slug темы «${t.slug}» уже есть (${topicSlugs.get(t.slug)})`);
    else topicSlugs.set(t.slug, t.where);
    for (const q of t.questions) {
      if (questionSeen.has(q)) errors.push(`${t.where}: вопрос «${q}» уже использован в теме «${questionSeen.get(q)}»`);
      else questionSeen.set(q, t.title);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n  "));

  return {
    file,
    slug: meta.slug,
    title: meta.title,
    role: meta.role,
    roleName: meta.roleName,
    level: meta.level,
    summary: meta.summary,
    sortOrder,
    intro,
    interviewFormat,
    topics,
  };
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

async function collectSlugs(files, pattern) {
  const set = new Set();
  for (const f of files) {
    const text = (await readFile(f, "utf8")).replace(/\r\n/g, "\n");
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) set.add(m[1].trim().replace(/^["']|["']$/g, ""));
  }
  return set;
}

async function loadLocalSlugs() {
  const questionFiles = (await walk("content/questions")).filter((f) => !/readme\.md$/i.test(f));
  const theoryFiles = (await walk("content/theory")).filter((f) => !/readme\.md$/i.test(f));
  const puzzleFiles = await walk("content/puzzles");

  const theory = new Set();
  for (const f of theoryFiles) {
    const text = (await readFile(f, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---")) continue;
    const end = text.indexOf("\n---", 3);
    if (end === -1) continue;
    const m = text.slice(3, end).match(/^slug:[ \t]*(.+?)[ \t]*$/m);
    if (m) theory.add(m[1].replace(/^["']|["']$/g, ""));
  }

  return {
    questions: await collectSlugs(questionFiles, /^slug:[ \t]*(.+?)[ \t]*$/gm),
    articles: theory,
    puzzles: await collectSlugs(puzzleFiles, /^slug:[ \t]*(.+?)[ \t]*$/gm),
  };
}

function checkLinks(guide, local) {
  const errors = [];
  for (const t of guide.topics) {
    for (const q of t.questions) if (!local.questions.has(q)) errors.push(`${t.where}: нет вопроса «${q}» в content/questions`);
    for (const a of t.articles) if (!local.articles.has(a)) errors.push(`${t.where}: нет статьи «${a}» в content/theory`);
    for (const p of t.puzzles) if (!local.puzzles.has(p)) errors.push(`${t.where}: нет задачи «${p}» в content/puzzles`);
  }
  return errors;
}

function summarize(guide) {
  const sum = (key) => guide.topics.reduce((n, t) => n + t[key].length, 0);
  console.log(
    `  ${guide.file}\n` +
      `    ${guide.title} (${guide.slug}, ${guide.role}/${guide.level}, order=${guide.sortOrder})\n` +
      `    тем: ${guide.topics.length}, вопросов: ${sum("questions")}, статей: ${sum("articles")}, задач: ${sum("puzzles")}\n`,
  );
}

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

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
      let errors;
      try {
        const j = JSON.parse(text);
        errors = j.errors;
        detail = j.detail ?? j.title ?? JSON.stringify(j.errors ?? j);
      } catch {
        detail = text;
      }
      throw new ApiError(`${method} ${path} → ${res.status}: ${String(detail).slice(0, 400)}`, res.status, errors);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  put = (p, b) => this.call("PUT", p, b);

  async login(email, password) {
    const auth = await this.call("POST", "/api/auth/login", { email, password });
    this.token = auth.accessToken;
    return auth.user;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const files = args.file
    ? [args.file]
    : (await readdir("content/prep").catch(() => {
        throw new Error("Каталог content/prep не найден (запускайте из корня репозитория или укажите --file)");
      })).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort().map((f) => join("content/prep", f));
  if (files.length === 0) throw new Error("В content/prep нет .md-файлов");

  let failed = false;
  const guides = [];
  for (const file of files) {
    try {
      guides.push(parseGuide(await readFile(file, "utf8"), file));
    } catch (e) {
      failed = true;
      console.error(`Ошибка: ${e.message}\n`);
    }
  }

  if (args.dryRun) {
    const local = await loadLocalSlugs();
    for (const guide of guides) {
      summarize(guide);
      const errors = checkLinks(guide, local);
      if (errors.length > 0) {
        failed = true;
        console.error(`  Ссылки не найдены:\n    ${errors.join("\n    ")}\n`);
      }
    }
    console.log(`Гайдов: ${guides.length}. Это dry-run: ничего не отправлено.`);
    if (failed) process.exitCode = 1;
    return;
  }

  if (!args.url || !args.email || !args.password) {
    throw new Error("Нужны --url, --email и пароль (--password или IH_ADMIN_PASSWORD).");
  }

  const api = new Api(args.url);
  const user = await api.login(args.email, args.password);
  console.log(`Вход: ${user.displayName} (${user.email})\n`);

  for (const guide of guides) {
    const payload = {
      slug: guide.slug,
      title: guide.title,
      role: guide.role,
      roleName: guide.roleName,
      level: guide.level,
      summary: guide.summary,
      intro: guide.intro,
      interviewFormat: guide.interviewFormat,
      sortOrder: guide.sortOrder,
      ...(args.publish ? { publish: true } : {}),
      topics: guide.topics.map((t) => ({
        slug: t.slug,
        title: t.title,
        body: t.body,
        questions: t.questions,
        articles: t.articles,
        puzzles: t.puzzles,
      })),
    };

    try {
      const res = await api.put("/api/admin/prep", payload);
      console.log(`  ${res.created ? "+" : "↻"} ${res.slug} — ${res.created ? "создан" : "обновлён"}, статус ${STATUS_NAMES[res.status] ?? res.status}`);
    } catch (e) {
      failed = true;
      if (e instanceof ApiError && e.status === 400) {
        console.error(`  ✗ ${guide.file}: ошибки валидации`);
        if (e.errors) {
          for (const [key, msgs] of Object.entries(e.errors)) {
            console.error(`    ${key}: ${[].concat(msgs).join("; ")}`);
          }
        } else {
          console.error(`    ${e.message}`);
        }
      } else {
        throw e;
      }
    }
  }

  if (!args.publish) console.log("\nСтатус — «Черновик»: гостям не видны до публикации.");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\nОшибка: ${e.message}`);
  process.exit(1);
});
