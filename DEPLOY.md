# Деплой InterviewHub на interview.hypex.site

Проект живёт на общем VPS hypex.site за обратным прокси **Caddy**.
Общие правила инфраструктуры — в корневом `DEPLOY_HYPEX.md`; здесь только
то, что специфично для InterviewHub. **Прочитать оба файла перед первым деплоем.**

- **Домен**: `interview.hypex.site`
- **Путь на сервере**: `/root/interviewhub`
- **Compose**: `docker-compose.hypex.yml`
- **Паттерн**: фронтенд сам проксирует API (как barberos)

```
Cloudflare (HTTPS) → сервер :80 → Caddy → interviewhub-frontend:80 ─┬─ SPA
                                                                    └─ /api/, /health → interviewhub-api:8080
                                        interviewhub-api ↔ interviewhub-postgres (сеть backend)
```

---

## Первый деплой

### 1. Сервер: клон и `.env`

Первый прогон CI упадёт без клона и `.env`, поэтому один раз вручную:

```bash
ssh -i D:/keys/hetznerkeyssh root@<SSH_HOST>

docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
cd /root && git clone <repo-url> interviewhub
cd /root/interviewhub
cp .env.example .env

# Сгенерировать секреты:
openssl rand -base64 48    # → Jwt__Key
openssl rand -base64 24    # → POSTGRES_PASSWORD

nano .env

# Проверки перед запуском:
grep -c CHANGE_ME .env                                   # должно быть 0
docker compose -f docker-compose.hypex.yml config >/dev/null && echo OK
```

> Пароль в `POSTGRES_PASSWORD` и внутри `ConnectionStrings__Default` — одно
> и то же значение в двух местах. Рассинхрон здесь — самая частая ошибка.

> `Jwt__Key` короче 32 символов уронит API на старте. Это намеренно:
> лучше не подняться, чем работать с подбираемым ключом.

### 2. Маршрут в Caddy (репозиторий `corpdev`)

В `corpdev/infra/Caddyfile`:

```
# ── interviewhub ─────────────────────────────
http://interview.hypex.site {
	encode zstd gzip
	reverse_proxy interviewhub-frontend:80
}
```

Плюс строка в таблицу маршрутов `corpdev/infra/README.md`.

### 3. DNS

Запись `interview` в Cloudflare (A на IP сервера), **оранжевое облачко**.

### 4. Секреты GitHub

`SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` — в Settings → Secrets → Actions
этого репозитория.

### 5. Push — порядок важен

```
1) push corpdev      → Caddy узнаёт о домене
2) push interviewhub → CI поднимает стек и перезапускает Caddy
```

### 6. Проверка

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://interview.hypex.site/          # 200
curl -s https://interview.hypex.site/health                                     # Healthy
curl -s https://interview.hypex.site/api/stats                                  # JSON, не HTML
curl -s -o /dev/null -w "%{http_code}\n" https://interview.hypex.site/api/nope  # 404 от .NET
```

Если `/api/...` вернул HTML — запрос ушёл на SPA-fallback вместо бэкенда:
смотреть `location /api/` в `frontend/nginx.conf`.

### 7. Первый вход

`https://interview.hypex.site/admin/login` — учётные данные из
`Bootstrap__Admin__*`. **Сразу сменить пароль**: Пользователи → иконка ключа.

База в проде поднимается с одними справочниками (7 категорий, 5 грейдов,
10 компаний) и **без демо-вопросов** — контент наполняется через админку.

---

## Обновление

`git push` в `main` — дальше CI сам. Ручной запуск: Actions → Deploy → Run workflow.

---

## Локальная проверка прод-сборки

Перед деплоем удобно прогнать тот же стек локально:

```bash
docker compose up -d --build      # http://localhost:8088
docker compose logs -f api
docker compose down               # добавить -v, чтобы стереть и данные
```

Это отдельный от `docker-compose.hypex.yml` файл: здесь порты опубликованы
наружу и секреты нарочно нестрогие, потому что стек локальный.

Дымовые тесты умеют работать против контейнера:

```bash
cd frontend && VITE_API_URL=http://localhost:8088 npm run smoke
```

---

## Специфика проекта

**Миграции применяются сами при старте API** (`db.Database.MigrateAsync()`),
отдельного шага в деплое нет. Обратная сторона: откат приложения на прошлую
версию не откатывает схему — при несовместимом изменении миграцию
придётся откатывать руками.

**`DemoContent` не сеется в Production** — проверка `IsDevelopment()`
в `Program.cs`. В `docker-compose.hypex.yml` жёстко задан
`ASPNETCORE_ENVIRONMENT: Production`; менять его на сервере нельзя,
иначе в прод приедут 13 демо-вопросов.

**nginx проекта НЕ включает gzip.** Сжатие делает Caddy; двойное сжатие
даёт `Content-Length: 0` и белый экран (`DEPLOY_HYPEX.md`, грабля №1).

**После пересборки — `restart caddy`, не `reload`** (грабля №2). Уже
зашито в `.github/workflows/deploy.yml`.

---

## Бэкап и восстановление

```bash
cd /root/interviewhub
set -a && . ./.env && set +a

# Бэкап
docker compose -f docker-compose.hypex.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz

# Восстановление. Схему сначала сносим: дамп содержит CREATE TABLE и INSERT,
# и накат поверх существующих данных упадёт на дублях ключей.
docker compose -f docker-compose.hypex.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

gunzip -c backup-2026-08-24.sql.gz | docker compose -f docker-compose.hypex.yml \
  exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

> Проверено на живом стеке: бэкап → удаление вопроса → restore возвращает
> данные. API перезапускать не нужно — он переоткрывает соединения сам.

Данные лежат в volume `interviewhub_pgdata` и переживают `up -d --build`.
Стирает их только `docker compose down -v` — этой команды на проде избегать.

---

## Диагностика

```bash
cd /root/interviewhub
docker compose -f docker-compose.hypex.yml ps
docker compose -f docker-compose.hypex.yml logs -f api
docker compose -f docker-compose.hypex.yml logs --tail=100 frontend

cd /root/corpdev/infra && docker compose logs -f caddy
docker network inspect proxy      # frontend должен быть в списке
```

| Симптом | Причина |
|---|---|
| Белый экран, JS с `Content-Length: 0` | gzip в nginx проекта, либо нужен `restart caddy` |
| `502` от Caddy | контейнер `interviewhub-frontend` не поднялся или не в сети `proxy` |
| API не стартует | `Jwt__Key` короче 32 символов или пуст |
| `/api/*` отдаёт HTML | не сработал `location /api/` в nginx |
| Логин не проходит | `Bootstrap__Admin__*` не заданы — админ не создан (видно в логах API) |
| Старая статика после деплоя | Cloudflare → Caching → Purge Everything, проверять в инкогнито |
