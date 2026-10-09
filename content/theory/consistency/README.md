# Раздел «Согласованность» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела
`consistency`. Метаданные — во фронтматтере каждого файла, тело —
markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/consistency

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/consistency

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/consistency
```

Первая команда показывает, что будет сделано, вторая заливает локально,
третья — в прод. Пароль для прода передаётся через переменную окружения,
а не флагом: флаг виден в списке процессов и остаётся в history шелла.

**Импорт берёт один каталог за раз** и по умолчанию читает `csharp-lang`,
поэтому `--dir` обязателен — без него этот раздел просто не зальётся,
и сообщения об ошибке не будет.

По умолчанию статьи создаются **черновиками** и существующие не трогаются.
`--update` обновляет по slug, `--publish` ставит статус «Опубликована».
Привязки к вопросам импорт не стирает: при обновлении они переносятся как есть.

Метаданные берутся из фронтматтера в начале каждого файла — `title`, `slug`,
`track`, `section`, `level`, `sortOrder`, `summary`. `readingMinutes` не задаётся:
его считает `AppDbContext.SaveChangesAsync` (200 слов в минуту, минимум 1).

## Файлы и источник правды

**Источник правды — база.** Мелкие правки удобнее делать в админке
(`/admin/theory`). Если правите файл здесь — прогоните импорт с `--update`,
иначе версии разойдутся.

## Что куда

| Файл | Заголовок | Slug | Грейд | Порядок |
| --- | --- | --- | --- | --- |
| `01-cap-na-samom-dele.md` | CAP на самом деле | `cap-na-samom-dele` | middle | 1 |
| `02-pacelc.md` | PACELC | `pacelc` | senior | 2 |
| `03-modeli-soglasovannosti.md` | Модели согласованности | `modeli-soglasovannosti` | senior | 3 |
| `04-read-your-writes.md` | Read-your-writes | `read-your-writes` | middle | 4 |
| `05-logicheskie-i-vektornye-chasy.md` | Логические и векторные часы | `logicheskie-i-vektornye-chasy` | senior | 5 |
| `06-pochemu-nelzya-verit-chasam.md` | Почему нельзя верить часам | `pochemu-nelzya-verit-chasam` | middle | 6 |
| `07-konsensus-i-raft.md` | Консенсус и Raft | `konsensus-i-raft` | senior | 7 |
| `08-vybor-lidera.md` | Выбор лидера | `vybor-lidera` | senior | 8 |
| `09-pochemu-2pc-problematichen.md` | Почему 2PC проблематичен | `pochemu-2pc-problematichen` | senior | 9 |
| `10-raspredelennye-blokirovki.md` | Распределённые блокировки | `raspredelennye-blokirovki` | senior | 10 |

Все десять — трек `distributed`, раздел `consistency`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `distributed` включается переключателем «виден» в админке — сидер
создаёт треки скрытыми. Если раздел заливается раньше `system-design-basics`,
проверьте, что трек уже включён.

## Раздел написан целиком

Все 10 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `distributed-systems` из `content/questions/distributed-systems.md`,
с опорой на `system-design.md` и `microservices.md`, переписанные
в связный текст.

Замеров в этом разделе нет. Числа в статьях — общеизвестные значения
и умолчания, их стоит перепроверить при обновлении версий:

- **Raft**: election timeout 150–300 мс в статье Онгаро и Оустерхаута;
  в etcd по умолчанию heartbeat 100 мс и election timeout 1000 мс;
- **Kubernetes leader election**: lease 15 с, renew deadline 10 с,
  retry 2 с — умолчания kube-controller-manager;
- **часы**: дрейф 50 ppm ≈ 4 с в сутки; допуск `ClockSkew` в JWT-валидации
  .NET — 5 минут; максимальное расхождение часов в CockroachDB — 500 мс
  по умолчанию;
- **2PC**: `max_prepared_transactions = 0` по умолчанию в PostgreSQL;
  пять участников по 99.9% дают ≈ 99.5%; распределённые транзакции
  через MSDTC в .NET — с .NET 7, только Windows;
- **кворумы**: 2f + 1 узлов переживают f падений, 3f + 1 — f византийских.

Ссылки на чужие тексты (Гилберт и Линч, Брюер, Клеппман, antirez, FLP,
Lamport, Spanner) даны по памяти, без проверки дословных формулировок;
пересказ позиций в споре о Redlock намеренно осторожный.

Темы, которые здесь только упоминаются, раскрываются в соседних разделах:
репликация, failover и кэш — `data-at-scale`, уровни изоляции и блокировки
PostgreSQL — `postgresql`, `lock` и примитивы внутри процесса — `concurrency`,
ретраи и идемпотентность — `reliability`, outbox, саги и exactly-once —
`microservices`.
