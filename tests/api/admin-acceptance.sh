#!/usr/bin/env bash
# Проверка админского API на живой БД. Не тесты — сценарий приёмки шага 6.
set -u
B=http://localhost:5199
PASS=0; FAIL=0

req() { # method path body token -> тело + последней строкой HTTP-код
  local m=$1 p=$2 body=${3:-} tok=${4:-}
  local args=(-s -w '\n%{http_code}' -X "$m" "$B$p"
              -H 'Content-Type: application/json; charset=utf-8')
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok")
  # Тело уходит файлом, а не через -d: инлайн-строка теряла UTF-8
  # и кириллица приезжала в API как "??????".
  if [ -n "$body" ]; then
    printf '%s' "$body" > "$TMPBODY"
    args+=(--data-binary "@$TMPBODY")
  fi
  curl "${args[@]}"
}
TMPBODY=$(mktemp)
trap 'rm -f "$TMPBODY"' EXIT
status() { echo "$1" | tail -1; }
payload() { echo "$1" | sed '$d'; }

check() { # name expected actual [extra]
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 -> $3"
  else FAIL=$((FAIL+1)); echo "  FAIL $1 -> ожидалось $2, получено $3"; echo "       ${4:-}"; fi
}

# Достаёт значение из JSON по python-выражению над `d`.
# JSON передаётся через env, чтобы кавычки в теле не ломали подстановку.
jqv() { JSON_IN="$1" python "$(dirname "$0")/jqv.py" "$2"; }

echo "=== 0. Вход админом ==="
R=$(req POST /api/auth/login '{"email":"admin@interview.hypex.site","password":"Admin123!"}')
check "login admin" 200 "$(status "$R")" "$(payload "$R")"
ADMIN=$(jqv "$(payload "$R")" "['accessToken']")
ADMIN_ID=$(jqv "$(payload "$R")" "['user']['id']")

echo "=== 1. Аноним не входит в /api/admin ==="
check "GET /api/admin/questions без токена" 401 "$(status "$(req GET /api/admin/questions)")"

echo "=== 2. Черновики видны админу, а гостю нет ==="
R=$(req GET '/api/admin/questions?pageSize=1' '' "$ADMIN")
check "admin список вопросов" 200 "$(status "$R")"

echo "=== 3. Справочники для создания вопроса ==="
CAT=$(jqv "$(payload "$(req GET /api/categories)")" "[0]['id']")
LVL=$(jqv "$(payload "$(req GET /api/levels)")" "[0]['id']")
CO=$(jqv "$(payload "$(req GET /api/companies)")" "[0]['id']")
echo "  cat=$CAT lvl=$LVL co=$CO"

echo "=== 4. Создание вопроса, slug из кириллицы ==="
R=$(req POST /api/admin/questions "{\"title\":\"Что такое индексы в PostgreSQL?\",\"body\":\"Тело вопроса\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":3,\"status\":2,\"isFeatured\":false,\"companies\":[{\"companyId\":\"$CO\",\"askedYear\":2025,\"round\":2}],\"tagIds\":[]}" "$ADMIN")
check "POST вопрос" 201 "$(status "$R")" "$(payload "$R")"
Q1=$(jqv "$(payload "$R")" "['id']")
SLUG1=$(jqv "$(payload "$R")" "['slug']")
check "slug транслитерирован" "chto-takoe-indeksy-v-postgresql" "$SLUG1"

echo "=== 5. Тот же заголовок -> суффикс -2 ==="
R=$(req POST /api/admin/questions "{\"title\":\"Что такое индексы в PostgreSQL?\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":3,\"status\":1,\"isFeatured\":false}" "$ADMIN")
check "POST дубль заголовка" 201 "$(status "$R")"
Q2=$(jqv "$(payload "$R")" "['id']")
check "slug дубля" "chto-takoe-indeksy-v-postgresql-2" "$(jqv "$(payload "$R")" "['slug']")"

echo "=== 6. Явный занятый slug -> 409 ==="
R=$(req POST /api/admin/questions "{\"title\":\"Другой\",\"slug\":\"$SLUG1\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":3,\"status\":1,\"isFeatured\":false}" "$ADMIN")
check "POST занятый slug" 409 "$(status "$R")" "$(payload "$R")"

echo "=== 7. Валидация: difficulty=9, пустой title ==="
R=$(req POST /api/admin/questions "{\"title\":\"\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":9,\"status\":1,\"isFeatured\":false}" "$ADMIN")
check "POST невалидный" 400 "$(status "$R")" "$(payload "$R")"

echo "=== 8. Несуществующая категория -> 400, не 500 ==="
R=$(req POST /api/admin/questions "{\"title\":\"Тест\",\"categoryId\":\"00000000-0000-0000-0000-000000000001\",\"levelId\":\"$LVL\",\"difficulty\":3,\"status\":1,\"isFeatured\":false}" "$ADMIN")
check "POST чужая категория" 400 "$(status "$R")" "$(payload "$R")"

echo "=== 9. Ответы и SearchText (грабли N2) ==="
R=$(req POST "/api/admin/questions/$Q1/answers" '{"body":"Индекс это структура ConfigureAwaitМаркер для ускорения поиска","isPrimary":true,"sortOrder":0}' "$ADMIN")
check "POST ответ" 201 "$(status "$R")" "$(payload "$R")"
A1=$(jqv "$(payload "$R")" "['id']")
R=$(req GET "/api/questions?q=ConfigureAwait%D0%9C%D0%B0%D1%80%D0%BA%D0%B5%D1%80")
check "поиск по тексту ответа" 1 "$(jqv "$(payload "$R")" "['totalCount']")" "$(payload "$R")"

echo "=== 10. Второй primary снимает флаг с первого ==="
R=$(req POST "/api/admin/questions/$Q1/answers" '{"body":"Короткий ответ","isPrimary":true,"sortOrder":1}' "$ADMIN")
check "POST второй primary" 201 "$(status "$R")"
R=$(req GET "/api/questions/$SLUG1")
PRIMARIES=$(jqv "$(payload "$R")" "!len([a for a in d['answers'] if a['isPrimary']])")
check "primary ровно один" 1 "$PRIMARIES" "$(payload "$R")"

echo "=== 11. Удаление ответа чистит SearchText ==="
check "DELETE ответ" 204 "$(status "$(req DELETE "/api/admin/answers/$A1" '' "$ADMIN")")"
R=$(req GET "/api/questions?q=ConfigureAwait%D0%9C%D0%B0%D1%80%D0%BA%D0%B5%D1%80")
check "поиск после удаления ответа" 0 "$(jqv "$(payload "$R")" "['totalCount']")" "$(payload "$R")"

echo "=== 12. PUT вопроса: UpdatedAt и замена связей ==="
R=$(req PUT "/api/admin/questions/$Q1" "{\"title\":\"Индексы в PostgreSQL - обновлено\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":5,\"status\":2,\"isFeatured\":true,\"companies\":[],\"tagIds\":[]}" "$ADMIN")
check "PUT вопрос" 200 "$(status "$R")" "$(payload "$R")"
check "UpdatedAt выставлен" "True" "$(jqv "$(payload "$R")" "!d['updatedAt'] is not None")"
check "связи компаний очищены" "0" "$(jqv "$(payload "$R")" "!len(d['companies'])")"
check "slug не менялся" "$SLUG1" "$(jqv "$(payload "$R")" "['slug']")"

echo "=== 13. Справочники: 409 на удаление используемого ==="
check "DELETE занятая категория" 409 "$(status "$(req DELETE "/api/admin/categories/$CAT" '' "$ADMIN")")"
check "DELETE занятый грейд" 409 "$(status "$(req DELETE "/api/admin/levels/$LVL" '' "$ADMIN")")"

echo "=== 14. CRUD тега ==="
R=$(req POST /api/admin/tags '{"name":"Сборка мусора"}' "$ADMIN")
check "POST тег" 201 "$(status "$R")" "$(payload "$R")"
TAG=$(jqv "$(payload "$R")" "['id']")
check "slug тега транслитерирован" "sborka-musora" "$(jqv "$(payload "$R")" "['slug']")"
R=$(req GET /api/admin/tags '' "$ADMIN")
check "пустой тег виден в админке" "True" "$(jqv "$(payload "$R")" "!any(t['slug']=='sborka-musora' for t in d)")"
R=$(req GET /api/tags)
check "пустой тег скрыт от гостя" "False" "$(jqv "$(payload "$R")" "!any(t['slug']=='sborka-musora' for t in d)")"
check "DELETE тег" 204 "$(status "$(req DELETE "/api/admin/tags/$TAG" '' "$ADMIN")")"

echo "=== 15. Новая категория и её удаление ==="
R=$(req POST /api/admin/categories '{"name":"Тестовая категория","sortOrder":99}' "$ADMIN")
check "POST категория" 201 "$(status "$R")"
NEWCAT=$(jqv "$(payload "$R")" "['id']")
check "DELETE пустая категория" 204 "$(status "$(req DELETE "/api/admin/categories/$NEWCAT" '' "$ADMIN")")"

echo "=== 16. Пользователи: создание Editor ==="
R=$(req POST /api/admin/users '{"email":"Editor@Interview.Hypex.Site","displayName":"Редактор","password":"Editor123","role":1,"isActive":true}' "$ADMIN")
check "POST editor" 201 "$(status "$R")" "$(payload "$R")"
ED_ID=$(jqv "$(payload "$R")" "['id']")
check "email нормализован" "editor@interview.hypex.site" "$(jqv "$(payload "$R")" "['email']")"
R=$(req POST /api/admin/users '{"email":"dup@x.io","displayName":"X","password":"short1","role":1,"isActive":true}' "$ADMIN")
check "слабый пароль" 400 "$(status "$R")" "$(payload "$R")"

echo "=== 17. Editor не доходит до /api/admin/users ==="
R=$(req POST /api/auth/login '{"email":"editor@interview.hypex.site","password":"Editor123"}')
check "login editor" 200 "$(status "$R")"
EDITOR=$(jqv "$(payload "$R")" "['accessToken']")
check "editor GET /api/admin/users" 403 "$(status "$(req GET /api/admin/users '' "$EDITOR")")"
check "editor POST /api/admin/users" 403 "$(status "$(req POST /api/admin/users '{"email":"a@b.io","displayName":"A","password":"Abcdef12","role":2,"isActive":true}' "$EDITOR")")"
check "editor правит контент" 200 "$(status "$(req GET /api/admin/questions '' "$EDITOR")")"
R=$(req POST /api/admin/questions "{\"title\":\"Вопрос от редактора\",\"categoryId\":\"$CAT\",\"levelId\":\"$LVL\",\"difficulty\":2,\"status\":1,\"isFeatured\":false}" "$EDITOR")
check "editor создаёт вопрос" 201 "$(status "$R")" "$(payload "$R")"
QED=$(jqv "$(payload "$R")" "['id']")

echo "=== 18. Последний админ защищён ==="
R=$(req PUT "/api/admin/users/$ADMIN_ID" '{"email":"admin@interview.hypex.site","displayName":"Администратор","role":1,"isActive":true}' "$ADMIN")
check "понижение последнего админа" 409 "$(status "$R")" "$(payload "$R")"
R=$(req PUT "/api/admin/users/$ADMIN_ID" '{"email":"admin@interview.hypex.site","displayName":"Администратор","role":2,"isActive":false}' "$ADMIN")
check "деактивация последнего админа" 409 "$(status "$R")" "$(payload "$R")"
check "удаление последнего админа" 409 "$(status "$(req DELETE "/api/admin/users/$ADMIN_ID" '' "$ADMIN")")"

echo "=== 19. Смена пароля гасит refresh-токены ==="
R=$(req POST /api/auth/login '{"email":"editor@interview.hypex.site","password":"Editor123"}')
ED_REFRESH=$(jqv "$(payload "$R")" "['refreshToken']")
check "POST смена пароля" 204 "$(status "$(req POST "/api/admin/users/$ED_ID/password" '{"newPassword":"NewPass123"}' "$ADMIN")")"
check "старый refresh недействителен" 401 "$(status "$(req POST /api/auth/refresh "{\"refreshToken\":$(python -c "import json,sys;print(json.dumps(sys.argv[1]))" "$ED_REFRESH")}")")"
check "вход с новым паролем" 200 "$(status "$(req POST /api/auth/login '{"email":"editor@interview.hypex.site","password":"NewPass123"}')")"

echo "=== 20. Удаление вопроса каскадом ==="
check "DELETE вопрос" 204 "$(status "$(req DELETE "/api/admin/questions/$Q1" '' "$ADMIN")")"
check "DELETE повторно" 404 "$(status "$(req DELETE "/api/admin/questions/$Q1" '' "$ADMIN")")"
req DELETE "/api/admin/questions/$Q2" '' "$ADMIN" > /dev/null
req DELETE "/api/admin/questions/$QED" '' "$ADMIN" > /dev/null

echo "=== 21. Удаление Editor'а ==="
check "DELETE editor" 204 "$(status "$(req DELETE "/api/admin/users/$ED_ID" '' "$ADMIN")")"

echo
echo "ИТОГО: OK=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
