import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

function parseArgs(argv) {
  const args = { dryRun: false, update: false, publish: false, puzzles: false, facts: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--update") args.update = true;
    else if (a === "--publish") args.publish = true;
    else if (a === "--puzzles") args.puzzles = true;
    else if (a === "--facts") args.facts = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--password") args.password = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  if (!args.puzzles && !args.facts) args.puzzles = args.facts = true;
  args.password ??= process.env.IH_ADMIN_PASSWORD;
  args.url ??= process.env.IH_API_URL;
  args.email ??= process.env.IH_ADMIN_EMAIL;
  return args;
}

const HELP = `
Импорт задач на код (content/puzzles) и фактов (content/facts) через админ-API.

  node tools/import-puzzles-facts.mjs --url <api> --email <admin> [--password <pwd>] [флаги]

Флаги:
  --puzzles      только задачи
  --facts        только факты (по умолчанию — и то и другое)
  --dry-run      разобрать файлы и показать план, ничего не отправляя
  --update       обновлять запись, если slug уже есть (по умолчанию пропускать)
  --publish      статус «Опубликован» вместо «Черновик»

Переменные окружения: IH_API_URL, IH_ADMIN_EMAIL, IH_ADMIN_PASSWORD.

Формат задачи:

  ## Заголовок
  \`\`\`yaml
  slug: zamykanie-v-cikle
  category: csharp
  level: middle
  kind: output        # output | bug
  difficulty: 3
  \`\`\`
  Условие…
  ### Варианты
  - [ ] вариант
  - [x] верный вариант
  - [ ] вариант
  - [ ] вариант
  ### Разбор
  Объяснение…

Формат факта: «## Заголовок», yaml-блок (slug, category) и тело.
`;

const STATUS = { draft: 1, published: 2 };
const KIND = { output: 1, bug: 2 };

function parseMeta(block, where) {
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

function mask(src) {
  return src.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, " "));
}

function splitSections(src, file) {
  const masked = mask(src);
  const heads = [];
  const re = /^## +(.+?)[ \t]*$/gm;
  let m;
  while ((m = re.exec(masked)) !== null) {
    heads.push({ title: m[1].trim(), start: m.index, bodyStart: re.lastIndex });
  }

  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const end = i + 1 < heads.length ? heads[i + 1].start : src.length;
    const raw = src.slice(h.bodyStart, end);
    const line = src.slice(0, h.start).split("\n").length;
    const where = `${file}:${line} («${h.title}»)`;

    const yaml = raw.match(/^\s*```ya?ml\s*\n([\s\S]*?)\n\s*```/);
    if (!yaml) continue;

    out.push({
      where,
      title: h.title,
      meta: parseMeta(yaml[1], where),
      rest: raw.slice(yaml.index + yaml[0].length),
    });
  }
  return out;
}

function findHeading(rest, name) {
  const re = new RegExp(`^###[ \\t]+${name}[ \\t]*$`, "m");
  const hit = re.exec(mask(rest));
  return hit ? { start: hit.index, end: hit.index + hit[0].length } : null;
}

function parsePuzzle(section) {
  const { where, title, meta, rest } = section;

  for (const key of ["slug", "category", "level", "kind"]) {
    if (!meta[key]) throw new Error(`${where}: не указано «${key}»`);
  }
  const kind = KIND[meta.kind.toLowerCase()];
  if (!kind) throw new Error(`${where}: kind должен быть output или bug`);

  const difficulty = meta.difficulty === undefined ? 3 : Number(meta.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(`${where}: difficulty должен быть целым 1–5`);
  }

  const options = findHeading(rest, "Варианты");
  const explanation = findHeading(rest, "Разбор");
  if (!options || !explanation || explanation.start < options.end) {
    throw new Error(`${where}: нужны разделы «### Варианты» и затем «### Разбор»`);
  }

  const body = rest.slice(0, options.start).trim();
  const optionLines = rest
    .slice(options.end, explanation.start)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const explanationText = rest.slice(explanation.end).replace(/\n---\s*$/, "").trim();

  const parsed = optionLines.map((l) => {
    const m = l.match(/^- \[( |x|X)\] +(.+)$/);
    if (!m) throw new Error(`${where}: строка варианта не в формате «- [ ] текст» — «${l}»`);
    return { text: m[2].trim(), isCorrect: m[1] !== " " };
  });

  if (parsed.length !== 4) throw new Error(`${where}: вариантов ${parsed.length}, нужно 4`);
  if (parsed.filter((o) => o.isCorrect).length !== 1) {
    throw new Error(`${where}: верным должен быть ровно один вариант`);
  }
  if (!body) throw new Error(`${where}: пустое условие`);
  if (!explanationText) throw new Error(`${where}: пустой разбор`);

  return {
    where,
    title,
    slug: meta.slug,
    category: meta.category.toLowerCase(),
    level: meta.level.toLowerCase(),
    kind,
    difficulty,
    body,
    explanation: explanationText,
    options: parsed,
  };
}

function parseFact(section) {
  const { where, title, meta, rest } = section;
  if (!meta.slug) throw new Error(`${where}: не указано «slug»`);
  const body = rest.replace(/\n---\s*$/, "").trim();
  if (!body) throw new Error(`${where}: пустой текст`);
  return {
    where,
    title,
    slug: meta.slug,
    category: meta.category ? meta.category.toLowerCase() : null,
    body,
  };
}

async function loadDir(dir, parse) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const items = [];
  for (const file of files) {
    const src = (await readFile(join(dir, file), "utf8")).replace(/\r\n/g, "\n");
    for (const section of splitSections(src, join(dir, file))) items.push(parse(section));
  }

  const seen = new Map();
  for (const item of items) {
    if (seen.has(item.slug)) throw new Error(`Дубль slug «${item.slug}»: ${seen.get(item.slug)} и ${item.where}`);
    seen.set(item.slug, item.where);
  }
  return items;
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
      try {
        const j = JSON.parse(text);
        detail = j.detail ?? j.title ?? JSON.stringify(j.errors ?? j);
      } catch {
        detail = text;
      }
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

async function upsert(api, args, label, items, existing, path, toPayload) {
  const stats = { created: 0, updated: 0, skipped: 0 };
  for (const item of items) {
    const payload = toPayload(item);
    const id = existing.get(item.slug);
    if (id && !args.update) {
      stats.skipped++;
      continue;
    }
    if (id) {
      await api.put(`${path}/${id}`, payload);
      stats.updated++;
      console.log(`  ↻ ${item.slug}`);
    } else {
      await api.post(path, payload);
      stats.created++;
      console.log(`  + ${item.slug}`);
    }
  }
  console.log(
    `${label}: создано ${stats.created}, обновлено ${stats.updated}, пропущено ${stats.skipped}\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const puzzles = args.puzzles ? await loadDir("content/puzzles", parsePuzzle) : [];
  const facts = args.facts ? await loadDir("content/facts", parseFact) : [];

  if (args.dryRun) {
    for (const p of puzzles) {
      console.log(`  задача ${p.category}/${p.level} ${p.kind === 1 ? "output" : "bug"} d${p.difficulty} ${p.slug}`);
    }
    for (const f of facts) console.log(`  факт   ${f.category ?? "—"} ${f.slug}`);
    console.log(`\nЗадач: ${puzzles.length}, фактов: ${facts.length}. Это dry-run: ничего не отправлено.`);
    return;
  }

  if (!args.url || !args.email || !args.password) {
    throw new Error("Нужны --url, --email и пароль (--password или IH_ADMIN_PASSWORD).");
  }

  const api = new Api(args.url);
  const user = await api.login(args.email, args.password);
  console.log(`Вход: ${user.displayName} (${user.email})\n`);

  const categories = new Map((await api.get("/api/admin/categories")).map((c) => [c.slug, c.id]));
  const levels = new Map((await api.get("/api/admin/levels")).map((l) => [l.slug, l.id]));

  const missing = [
    ...puzzles.filter((p) => !categories.has(p.category)).map((p) => `${p.where}: категория ${p.category}`),
    ...puzzles.filter((p) => !levels.has(p.level)).map((p) => `${p.where}: грейд ${p.level}`),
    ...facts
      .filter((f) => f.category && !categories.has(f.category))
      .map((f) => `${f.where}: категория ${f.category}`),
  ];
  if (missing.length > 0) {
    throw new Error(`Нет в справочниках, ничего не отправлено:\n  ${missing.join("\n  ")}`);
  }

  const status = args.publish ? STATUS.published : STATUS.draft;

  if (puzzles.length > 0) {
    const existing = new Map();
    for (let page = 1; ; page++) {
      const res = await api.get(`/api/admin/puzzles/?page=${page}&pageSize=100`);
      for (const p of res.items) existing.set(p.slug, p.id);
      if (res.items.length === 0 || existing.size >= res.totalCount) break;
    }

    await upsert(api, args, "Задачи", puzzles, existing, "/api/admin/puzzles", (p) => ({
      title: p.title,
      slug: p.slug,
      kind: p.kind,
      body: p.body,
      explanation: p.explanation,
      difficulty: p.difficulty,
      status,
      categoryId: categories.get(p.category),
      levelId: levels.get(p.level),
      options: p.options,
    }));
  }

  if (facts.length > 0) {
    const existing = new Map((await api.get("/api/admin/facts")).map((f) => [f.slug, f.id]));

    await upsert(api, args, "Факты", facts, existing, "/api/admin/facts", (f) => ({
      title: f.title,
      slug: f.slug,
      body: f.body,
      status,
      categoryId: f.category ? categories.get(f.category) : null,
    }));
  }
}

main().catch((e) => {
  console.error(`\nОшибка: ${e.message}`);
  process.exit(1);
});
