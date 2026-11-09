---
title: System Design — Senior
slug: system-design-senior
role: system-design
roleName: System Design
level: senior
sortOrder: 2
summary: Как провести секцию System Design на уровне Senior: вести разговор самому, считать и обосновывать компромиссы цифрами, разбирать отказы и эволюцию системы. Двенадцать тем от скоупинга до разбора типовых задач.
---

# Вступление

На секции System Design у Senior другая роль, чем у middle. Middle получает задачу и рисует разумную архитектуру из знакомых кубиков. Senior ведёт разговор сам: уточняет требования, предлагает порядок обсуждения, называет цифры, выбирает место для deep dive и честно говорит, что в его решении плохо.

### Что ожидают от Senior

- **Управление разговором.** Вы предлагаете план на первых минутах и держите его. Интервьюер не должен вытаскивать из вас следующий шаг вопросами.
- **Компромиссы с числами.** Не «Kafka надёжнее», а «при 50 тыс. событий/с по 1 КБ это около 50 МБ/с на запись, за неделю хранения около 30 ТБ, при RF=3 около 90 ТБ на диске; нужно больше десятка брокеров либо tiered storage или короткий retention».
- **Режимы отказа.** Для каждого компонента вы знаете, что произойдёт, когда он упадёт, замедлится или начнёт отвечать с ошибками, и что увидит пользователь.
- **Выбор консистентности.** Где нужна строгая консистентность, где хватит eventual, чем за это платим латентностью и сложностью.
- **Стоимость.** Железо, облако, трафик между зонами, стоимость хранения и стоимость поддержки решения командой.
- **Эволюция.** Как система выглядит на 1 тыс. пользователей, на миллионе, и какие шаги ведут от одного к другому без переписывания с нуля.
- **Эксплуатация.** Метрики, алерты, SLO, выкатка, миграции, откат, разбор инцидента.

### Чем это отличается от middle

- Middle отвечает на вопрос «как». Senior сначала отвечает «зачем и какой ценой».
- Middle называет технологию. Senior называет ограничение, которое к ней привело, и условие, при котором он от неё откажется.
- Middle проектирует счастливый путь. Senior начинает с неудобных сценариев: дубли, потеря сообщения, split brain, горячий ключ, retry storm.
- Middle не спорит с интервьюером. Senior вежливо возражает аргументом и меняет решение, если аргумент интервьюера лучше.

### Как пользоваться руководством

Темы идут в порядке изучения. Каждая тема содержит чек-лист «Что нужно знать», типичные провалы и привязанные вопросы и статьи. Сначала пройдите статьи темы, затем отвечайте на вопросы вслух, как на собеседовании, и только потом открывайте эталонный ответ. Последняя тема собирает всё вместе на типовых задачах: после неё решайте задачи на время.

### Бюджет времени подготовки

- Если до собеседования 2 недели: по теме в день, два вечера на полные прогоны задач, один вечер на повторение слабых мест.
- Если до собеседования неделя: темы 1, 2, 4, 5, 6, 7, 8, 9 и 12 обязательны (последняя это практика на задачах), остальные читайте по чек-листам.
- Каждую неделю делайте минимум два полных прогона по 45–60 минут с таймером, вслух или с партнёром. Чтение не заменяет тренировку рассказа.

# Формат собеседования

### Как проходит секция

Типичная секция на уровне Senior длится 60 минут. Ориентировочная раскладка:

| Этап | Минуты | Что происходит |
|---|---|---|
| Требования и скоуп | 5–8 | Функциональные и нефункциональные требования, что вне скоупа, SLA, объёмы |
| Оценки | 5 | RPS, хранилище, трафик, соотношение чтения и записи, пики |
| API и модель данных | 8–10 | Основные сущности, ключи, выбор хранилища, схема доступа |
| Высокоуровневая схема | 8–10 | Компоненты, потоки данных, синхронные и асинхронные границы |
| Deep dive | 15–20 | Один-два самых сложных узла: шардирование, консистентность, очередь, кэш |
| Узкие места и отказы | 5–8 | Что упадёт первым, как деградируем, как восстанавливаемся |
| Наблюдаемость и эволюция | 3–5 | Метрики, SLO, как расти дальше, что бы вы сделали в версии 2 |

### Что оценивают

- **Скоупинг.** Умение сузить размытую задачу и зафиксировать допущения вслух.
- **Оценки.** Порядки величин, а не точность. Важно, чтобы цифры влияли на решения.
- **Моделирование данных.** Сущности, ключи, индексы, паттерны доступа, выбор хранилища под них.
- **Deep dive.** Глубина в выбранном узле: что внутри, какие гарантии, где ломается.
- **Узкие места.** Умение найти слабое место в собственной схеме раньше интервьюера.
- **Компромиссы.** Явные альтернативы и причина выбора, а не единственный «правильный» вариант.
- **Надёжность.** Таймауты, ретраи, идемпотентность, деградация, восстановление.
- **Наблюдаемость.** Как вы узнаете, что система сломалась, и как найдёте причину.
- **Эволюция.** Как система растёт и как меняется без остановки.

### Красные флаги

- Рисовать схему до уточнения требований.
- Все цифры «на глаз» и ни одного решения, которое от них зависит.
- «Поставим Kafka и Redis» без ответа, что будет при их недоступности.
- Единая точка отказа, которую вы не заметили и не назвали.
- Нет ответа на вопрос «что при дубле сообщения / повторе запроса».
- Не умеете сказать, чем вы жертвуете выбранным решением.
- Молчаливое перебирание технологий вместо рассуждения о требованиях.
- Защита решения вместо его пересмотра при хорошем контраргументе.

### Типовые задачи уровня Senior

- Лента новостей: fan-out on write против fan-out on read, знаменитости, ранжирование.
- Мессенджер: доставка и порядок сообщений, статусы, группы, хранение истории, офлайн.
- Платёжная система и леджер: идемпотентность, двойная бухгалтерская запись (double-entry), согласованность, сверка.
- Сервис такси: геопоиск, матчинг, горячие районы, потоки координат.
- Распределённый rate limiter: алгоритмы, общее состояние, точность против задержки.
- Система уведомлений: приоритеты, дедупликация, повторы, внешние провайдеры.
- Поиск и typeahead: индексы, обновление индекса, задержка, ранжирование.
- Видеосервис: загрузка, транскодирование, CDN, хранение, стоимость трафика.

### Как вести deep dive

1. Сами предложите, куда копать: «Самое рискованное здесь хранение событий и порядок, давайте разберу его».
2. Сформулируйте инвариант, который нужно сохранить: «не списываем дважды», «сообщения одного чата в порядке».
3. Опишите механизм: ключ партиционирования, протокол записи, что происходит при ретрае.
4. Пройдите отказы: упал узел, задержалась сеть, пришёл дубль, пришло сообщение вне порядка.
5. Назовите цену решения: латентность, сложность, деньги, операционная нагрузка.
6. Назовите условие, при котором выбрали бы другое решение.

Темы ниже идут в порядке изучения. Для каждой подобраны вопросы с эталонными ответами и статьи теории.

## Ведение секции и скоупинг

```yaml
slug: vedenie-sekcii-i-skouping
questions: system-design-kak-nachat-proektirovanie-sistemy, system-design-kakie-trebovaniya-nuzhno-sobrat-pered-proektirovaniem, system-design-functional-vs-non-functional-requirements, system-design-chto-takoe-bottleneck, system-design-kak-obnaruzhit-i-ustranit-bottleneck, architecture-patterns-kak-prinimat-arhitekturnye-resheniya-i-kak-ih-dokumentirovat
articles: kak-prohodit-dizayn-sekciyu, funkcionalnye-i-nefunkcionalnye-trebovaniya, poisk-bottleneck, adr-dokumentirovanie-resheniy
puzzles:
```

**Что нужно знать**

- Порядок: требования, оценки, API и данные, схема, deep dive, отказы, эволюция. Озвучьте его в первые две минуты.
- Функциональные требования сводите к 3–5 главным сценариям и явно записываете, что вне скоупа.
- Нефункциональные требования всегда с числами: доступность (99,9% или 99,99%), p99-латентность, объём, допустимая потеря данных.
- Вопросы про консистентность задаёте сами: можно ли показывать устаревшие данные и на сколько.
- Допущения проговариваете вслух и фиксируете на доске, чтобы интервьюер мог их поправить.
- Определяете, что в системе читается чаще, а что пишется чаще, и отношение чтения к записи. От него зависит почти всё остальное.
- Схему начинаете с самого простого рабочего варианта и усложняете только там, где его ломают числа.
- Bottleneck ищете по цепочке: клиент, балансировщик, приложение, кэш, база, сеть, внешние зависимости. Для каждого звена знаете, как его измерить.
- Выбор фиксируете форматом «решение, альтернативы, причина, цена».
- Следите за временем и сами предлагаете, где углубиться.

**На чём валятся**

- Сразу рисуют микросервисы и очереди для задачи, которая решается одной базой.
- Не уточняют требования и решают не ту задачу.
- Ждут подсказок вместо того, чтобы вести разговор.

## Оценки и capacity planning

```yaml
slug: ocenki-i-capacity-planning
questions: system-design-chto-takoe-rps-qps, system-design-kak-ocenit-nagruzku-sistemy, system-design-kak-ocenit-storage-requirements, system-design-kak-ocenit-network-bandwidth, system-design-gorizontalnoe-ili-vertikalnoe-masshtabirovanie-kogda-zapuskat-bolshe-kopii, system-design-sproektirovat-sistemu-obrabotki-10-000-rps, system-design-senior-sproektiruite-sistemu-na-100-000-rps-s-chego-nachnete-i-chto-stanet-uz, devops-senior-kak-organizovat-nagruzochnoe-testirovanie-v-okruzhenii-blizkom-k-proda
articles: ocenka-nagruzki-i-rps, vertikalnoe-i-gorizontalnoe-masshtabirovanie, balansirovshchiki, sistema-na-100000-rps
puzzles:
```

**Что нужно знать**

- Базовые числа: секунд в сутках около 86 400 (для оценок берите 10^5), миллион запросов в день это около 12 RPS в среднем.
- Пик к среднему: закладывайте множитель 2–5, для событийных нагрузок (распродажа, трансляция) ещё больше.
- Оценка хранилища: размер записи, число записей в день, срок хранения, коэффициент репликации, запас на индексы.
- Оценка трафика: входящий и исходящий отдельно, учёт CDN, объём межзонных передач как отдельная статья расходов.
- Порядки латентности: память наносекунды-сотни наносекунд, SSD десятки-сотни микросекунд, сеть внутри зоны около 0,5 мс, между соседними регионами 10–30 мс, между континентами 100–150 мс.
- Возможности одного узла как ориентир: порядка тысяч-десятков тысяч RPS простого API, сотни тысяч IOPS на локальном NVMe, тысячи-десятки тысяч на сетевых облачных дисках, несколько тысяч транзакций в секунду на одном PostgreSQL для типовой записи.
- Закон Литтла: число запросов в системе равно RPS, умноженному на среднее время ответа. По нему считаете пулы соединений и потоки.
- Оценка нужна, чтобы принять решение: нужен ли шардинг, хватит ли одной реплики, нужен ли кэш. Цифра без вывода бесполезна.
- Масштабирование: вертикально до разумного предела, затем горизонтально с учётом состояния (stateless легко, stateful дорого).
- Нагрузочное тестирование проверяет оценки: профиль трафика, прогрев, измерение p99, а не только среднего.

**На чём валятся**

- Считают с точностью до процентов, но не делают вывода из результата.
- Забывают про пики и считают только среднее.
- Не учитывают репликацию и индексы при оценке хранилища.

## Модели данных и выбор хранилищ

```yaml
slug: modeli-dannyh-i-vybor-hranilisch
questions: system-design-kak-vybrat-database, system-design-sql-vs-nosql, postgresql-kak-rabotat-s-bolshimi-tablicami, advanced-postgresql-kak-ustroen-mvcc-v-postgresql-i-pochemu-update-sozdaet-novuyu-versiyu, advanced-postgresql-chem-otlichayutsya-urovni-izolyacii-na-praktike-i-kakie-anomalii-ostay, advanced-postgresql-kogda-stoit-vybrat-select-for-update-a-kogda-optimistichnuyu-blokirovk, advanced-postgresql-kak-menyat-shemu-bolshoi-tablicy-ne-blokiruya-zapis-nadolgo, advanced-postgresql-kak-bezopasno-sozdat-indeks-na-bolshoi-tablice-v-prodakshene
articles: sql-vs-nosql, mvcc-i-vacuum, pg-urovni-izolyacii, migracii-bd-pri-neskolkih-replikah
puzzles:
```

**Что нужно знать**

- Хранилище выбирается от паттернов доступа: какие запросы, какие ключи, нужны ли транзакции, join, диапазонные выборки, полнотекстовый поиск.
- Реляционная база по умолчанию. Выход в другое хранилище нужен, когда есть конкретная причина: объём записи, модель данных, географическое распределение, скорость поиска.
- Типы хранилищ и их ниша: key-value (кэш, сессии), документное (агрегаты), колоночное (аналитика), wide-column (высокая запись по ключу), поисковое (индекс), графовое (связи), объектное (файлы).
- Моделирование: сущности и агрегаты, что денормализуем ради чтения и чем платим за это при обновлении.
- Ключи: суррогатные или естественные, UUID против последовательных (фрагментация индекса, распределение нагрузки), составные ключи под запросы.
- MVCC в PostgreSQL: версии строк, bloat, autovacuum. Это объясняет, почему частые UPDATE дорогие.
- Уровни изоляции и аномалии, которые остаются на Read Committed и Repeatable Read; когда нужны SELECT FOR UPDATE или оптимистичная блокировка.
- Изменение схемы на живой таблице: добавление колонки с дефолтом, создание индекса CONCURRENTLY, expand-contract миграции при нескольких версиях приложения.
- Polyglot persistence даёт выигрыш, но вводит синхронизацию между хранилищами и несколько режимов отказа.
- Источник истины один, остальные хранилища это производные (индексы, кэши, витрины) и должны перестраиваться из него.

**На чём валятся**

- «Возьмём MongoDB, потому что масштабируется» без анализа запросов.
- Несколько хранилищ с неопределённым источником истины.
- Миграция, блокирующая таблицу на минуты в проде.

## Шардирование, репликация и партиционирование

```yaml
slug: shardirovanie-replikaciya-partitsionirovanie
questions: system-design-chto-takoe-replication, system-design-chto-takoe-sharding, system-design-kak-masshtabirovat-database, advanced-postgresql-chem-fizicheskaya-replikaciya-otlichaetsya-ot-logicheskoi-i-kogda-nuzh, advanced-postgresql-chto-takoe-replication-lag-kak-ego-izmeryat-i-kakie-posledstviya-u-cht, advanced-postgresql-kak-vybrat-klyuch-particionirovaniya-i-chto-proizoidet-pri-neudachnom, advanced-postgresql-kak-vypolnit-pereklyuchenie-na-repliku-bez-poteri-dannyh-i-kakoi-cenoi, system-design-senior-kak-vybrat-shemu-shardirovaniya-i-chto-delat-pri-neobhodimosti-reshard, system-design-senior-kak-pereshardirovat-dannye-bez-prostoya
articles: shardirovanie-i-vybor-klyucha, reshardirovanie-bez-prostoya, replikaciya-i-failover, partitsionirovanie-dannyh, pg-replikaciya, pg-particionirovanie
puzzles:
```

**Что нужно знать**

- Порядок масштабирования базы. Путь чтения: индексы и запросы, кэш, реплики на чтение. Путь записи: батчинг, асинхронная запись через очередь, партиционирование, затем шардирование. Лишние индексы замедляют запись, а реплики и кэш запись не масштабируют. Шардирование последнее, потому что оно дорого и почти необратимо.
- Репликация: синхронная, асинхронная, кворумная; что теряется при failover асинхронной реплики и как это измерить.
- Replication lag ломает read-your-writes: чтение с реплики сразу после записи. Решения: чтение с лидера после записи, привязка сессии, ожидание LSN.
- Партиционирование внутри одного узла: по диапазону времени (удобно удалять старое), по хеш-ключу, по списку. Выбор ключа от запросов.
- Шардирование: диапазонное, хеш, консистентное хеширование, directory-based. У каждого свои горячие точки и сложность решардинга.
- Ключ шардирования определяет всё: он должен давать равномерное распределение и держать типовой запрос внутри одного шарда.
- Горячие ключи и перекос: знаменитость, популярный товар, самый свежий диапазон при ключе по времени. Способы: salting, отдельные шарды, кэш.
- Кросс-шардовые запросы и транзакции: scatter-gather, денормализация, саги вместо распределённых транзакций.
- Решардинг без простоя: двойная запись (dual write) в старый и новый шард, бэкфилл, сверка, переключение чтения, отключение старого. Виртуальные шарды (больше логических шардов, чем физических узлов) упрощают переезд.
- Failover: обнаружение отказа, выбор лидера, защита от split brain (fencing), переключение клиентов.
- Глобальные уникальные идентификаторы без координации: Snowflake-подобные, ULID.

**На чём валятся**

- Предлагают шардирование до исчерпания дешёвых вариантов.
- Выбирают ключ с перекосом или таким, что основной запрос ходит по всем шардам.
- Не умеют объяснить, как перейти с N на 2N шардов в проде.

## Консистентность и консенсус

```yaml
slug: konsistentnost-i-konsensus
questions: distributed-systems-chto-realno-utverzhdaet-cap-teorema-i-kakie-vyvody-iz-nee-delayut-neve, distributed-systems-chto-dobavlyaet-pacelc-k-cap-i-pochemu-latency-vazhna-ne-menshe-consis, distributed-systems-chem-otlichayutsya-modeli-soglasovannosti-i-kakuyu-vybrat-dlya-korziny, distributed-systems-chto-takoe-read-your-writes-consistency-i-kak-obespechit-ee-pri-chteni, distributed-systems-pochemu-nelzya-doveryat-sistemnym-chasam-i-chto-takoe-clock-skew, distributed-systems-chto-takoe-logicheskie-i-vektornye-chasy-i-kakuyu-zadachu-oni-reshayut, distributed-systems-kak-rabotaet-raft-i-zachem-nuzhen-konsensus-esli-est-baza-dannyh, distributed-systems-kak-realizovat-vybor-lidera-i-chto-proizoidet-pri-split-brain, system-design-senior-kak-obespechit-konsistentnost-dannyh-v-multi-region-arhitekture
articles: cap-na-samom-dele, pacelc, modeli-soglasovannosti, read-your-writes, pochemu-nelzya-verit-chasam, logicheskie-i-vektornye-chasy, konsensus-i-raft, vybor-lidera
puzzles:
```

**Что нужно знать**

- CAP говорит о поведении при сетевом разделении: выбор между согласованностью и доступностью возникает только во время партиции, а не «всегда».
- PACELC добавляет вторую ось: без партиции выбор идёт между латентностью и консистентностью. Именно он объясняет цену синхронной репликации между регионами.
- Спектр моделей: линеаризуемость, последовательная, причинная, read-your-writes, monotonic reads, eventual. Для каждой умеете привести пример продукта.
- Выбор по сценарию: баланс и платёж требуют сильной консистентности, лента и счётчики лайков допускают eventual, корзина часто решается слиянием.
- Часы: системные часы расходятся, NTP не гарантирует порядка. Порядок событий задают логические часы (Lamport) и векторные часы, версии, последовательности из лидера.
- Last-write-wins теряет данные при расхождении часов; альтернативы: векторные версии, CRDT, слияние на уровне приложения.
- Консенсус (Raft, Paxos) нужен для выбора лидера, конфигурации, упорядоченного журнала. Кворум большинства и минимум три узла.
- Split brain: два узла считают себя лидерами. Защита: кворум, lease с TTL, fencing token, монотонно растущая эпоха (term).
- Multi-region: синхронная запись между регионами стоит от 10–30 мс (соседние регионы) до 100–150 мс (разные континенты) на каждую запись, асинхронная даёт потерю данных при падении региона. Паттерны: один лидер на регион по данным, home region пользователя, CRDT.
- Read-your-writes при лаге реплик решается маршрутизацией чтения, токеном версии, чтением с лидера в окне после записи.
- Консистентность формулируется как инвариант («остаток не отрицателен»), а затем подбирается механизм: ограничение в базе, одна запись по ключу, сериализация через лидера.

**На чём валятся**

- Пересказывают CAP как «выбери два из трёх».
- Предлагают LWW по системному времени для финансовых данных.
- Не отличают отказ узла от разделения сети и не говорят про fencing.

## Транзакции между сервисами: саги, outbox, идемпотентность

```yaml
slug: raspredelennye-tranzakcii-sagi-outbox-idempotentnost
questions: distributed-systems-pochemu-raspredelennye-tranzakcii-cherez-two-phase-commit-ploho-massht, distributed-systems-kak-obespechit-idempotentnost-operacii-esli-klient-povtoryaet-zapros-p, microservices-advanced-kak-realizovat-saga-i-v-chem-prakticheskaya-raznica-mezhdu-horeografie, microservices-advanced-kak-proektirovat-kompensiruyuschie-tranzakcii-esli-otkat-fizicheski-ne, microservices-advanced-kak-rabotaet-outbox-i-pochemu-bez-nego-vozmozhna-poterya-sobytiya, microservices-advanced-zachem-nuzhen-inbox-i-kak-on-zaschischaet-ot-povtornoi-obrabotki, distributed-systems-kak-realizovat-exactly-once-na-praktike-esli-set-nenadezhna, system-design-senior-kak-reshat-konflikt-mezhdu-consistency-i-availability-v-oplate-zakaza, kafka-advanced-kak-rabotaet-exactly-once-v-kafka-i-kakova-ego-realnaya-cena, kafka-advanced-pochemu-dlya-konsistentnosti-s-bd-vybirayut-outbox-a-ne-tranzakcii-kaf, system-design-senior-sproektiruite-sistemu-obrabotki-platezhei-s-garantiei-odnokratnogo-spi
articles: pochemu-2pc-problematichen, ms-saga, ms-outbox, idempotentnost, exactly-once-na-praktike, obrabotka-platezhey
puzzles:
```

**Что нужно знать**

- Двухфазный коммит блокирует ресурсы при падении координатора и плохо масштабируется; в микросервисах его избегают.
- Сага: цепочка локальных транзакций с компенсациями. Оркестрация даёт видимость и контроль, хореография даёт слабую связность и сложность отладки.
- Компенсация это новая бизнес-операция, а не откат: возврат платежа, а не «удаление списания». Некоторые шаги некомпенсируемы, их ставят последними.
- Состояние саги хранится в базе, шаги идемпотентны, у каждого шага таймаут и ограничение числа повторов.
- Dual write (запись в базу и публикация в брокер) нельзя сделать атомарно. Outbox: событие пишется в ту же транзакцию, отдельный процесс публикует его (polling или CDC).
- Outbox даёт доставку «минимум один раз», поэтому потребитель обязан быть идемпотентным: inbox-таблица или уникальный ключ обработанных сообщений.
- Идемпотентность запросов: клиентский ключ идемпотентности, хранение результата, уникальный индекс, поведение при гонке двух одинаковых запросов, срок хранения ключей.
- «Ровно один раз» на практике это at-least-once плюс идемпотентная обработка. Честное exactly-once возможно только в границах одной системы.
- Платёж: двойная бухгалтерская запись (double-entry) в леджер, неизменяемые записи, статусы с конечным автоматом, сверка с внешним провайдером, обработка неопределённого ответа (таймаут не значит отказ).
- Инвариант в платежах выше доступности: лучше временно отклонить операцию, чем списать дважды, но пользователю нужен понятный повторяемый сценарий.
- Реконсиляция: фоновые задачи находят зависшие операции и доводят их до финала или компенсации.

**На чём валятся**

- «Опубликуем событие после коммита» без ответа на вопрос, что если процесс упал между ними.
- Считают таймаут платёжного провайдера неуспехом и повторяют без ключа идемпотентности.
- Компенсации описывают как откат транзакции.

## Кэширование на масштабе

```yaml
slug: keshirovanie-na-masshtabe
questions: system-design-chto-takoe-caching-layer, system-design-kogda-nuzhen-redis, system-design-kak-organizovat-cdn, system-design-senior-kak-sproektirovat-kesh-na-desyatki-terabait-i-chto-delat-pri-potere-kl, system-design-senior-kak-predotvratit-cache-stampede-pri-invalidacii-populyarnogo-klyucha, system-design-senior-chto-proizoidet-pri-nedostupnosti-redis-i-kak-zaranee-sproektirovat-de, distributed-systems-pochemu-raspredelennaya-blokirovka-na-redis-nebezopasna-i-chto-predlag, distributed-systems-kak-oboitis-bez-raspredelennoi-blokirovki-izmeniv-model-dannyh
articles: keshirovanie, cache-stampede, raspredelennye-blokirovki
puzzles:
```

**Что нужно знать**

- Слои кэша: браузер, CDN, edge, кэш приложения (in-process), распределённый кэш, кэш базы. Для каждого свой TTL и свой способ инвалидации.
- Стратегии: cache-aside, read-through, write-through, write-behind. Цена каждой: окно устаревания, риск потери при write-behind, сложность.
- Инвалидация: TTL с джиттером, событийная инвалидация, версионирование ключей. Гарантировать строгую актуальность кэша очень дорого.
- Cache stampede: массовый промах по горячему ключу. Защита: single-flight/блокировка на ключ, ранний пересчёт по вероятности, stale-while-revalidate, прогрев.
- Cache penetration (запросы несуществующих ключей) и avalanche (одновременное истечение): отрицательное кэширование, фильтр Блума, джиттер TTL.
- Горячие ключи: локальный кэш перед Redis, реплики ключа, шардирование ключа с суффиксом.
- Распределение по узлам: консистентное хеширование, поведение при добавлении и потере узла, доля промахов после потери.
- Потеря кэша не должна ронять базу: ограничение конкурентных промахов, деградация (отдать упрощённый ответ), защита базы лимитами.
- Размер кэша и стоимость: hit ratio, стоимость памяти против стоимости промаха, политики вытеснения.
- Распределённая блокировка на Redis не даёт безопасности при паузах процесса и дрейфе часов; нужен fencing token или смена модели данных (уникальные ограничения, оптимистичная версия).

**На чём валятся**

- Не говорят, что происходит с базой при холодном кэше.
- Инвалидацию описывают как «удалим ключ» без разбора гонок между записью и заполнением.
- Берут Redis-блокировку как гарантию взаимного исключения.

## Messaging и event-driven

```yaml
slug: messaging-i-event-driven
questions: system-design-kogda-nuzhen-message-broker, system-design-kogda-nuzhen-kafka, kafka-advanced-kakie-garantii-dostavki-daet-kafka-i-kak-nastroiki-acks-i-retries-na-n, kafka-advanced-chto-proizoidet-pri-acks-1-i-padenii-lidera-particii, kafka-advanced-kak-rabotaet-min-insync-replicas-i-chto-proizoidet-pri-potere-replik, kafka-advanced-kak-vybrat-strategiyu-particionirovaniya-i-chto-proizoidet-pri-perekos, kafka-advanced-kak-sohranit-poryadok-soobschenii-pri-parallelnoi-obrabotke-vnutri-odn, distributed-systems-kak-obespechit-poryadok-obrabotki-sobytii-dlya-odnoi-suschnosti-pri-pa, kafka-advanced-kak-uskorit-obrabotku-esli-dobavlenie-consumer-ov-bolshe-ne-pomogaet, kafka-advanced-chto-proishodit-vo-vremya-consumer-rebalance-i-kak-minimizirovat-prost, kafka-advanced-kak-obrabatyvat-poison-message-ne-ostanavlivaya-obrabotku-vsei-partici, system-design-senior-sproektiruite-obrabotku-milliona-sobytii-v-sekundu-s-garantiei-otsutst
articles: kafka-model, kafka-particii-i-poryadok-sobytiy, kafka-consumer-groups, kafka-garantii-dostavki, kafka-retention-i-compaction, kafka-obrabotka-oshibok-i-dlq
puzzles:
```

**Что нужно знать**

- Когда нужен брокер: развязка по времени, сглаживание пиков, fan-out, повторное чтение. Когда не нужен: запрос-ответ с жёсткой латентностью, малая нагрузка.
- Очередь (RabbitMQ-подобная) против лога (Kafka): удаление после подтверждения против хранения и повторного чтения по смещению.
- Гарантии доставки: at-most-once, at-least-once, exactly-once. Что именно даёт Kafka и где заканчиваются её гарантии.
- Надёжная запись: acks=all, min.insync.replicas, replication factor 3, идемпотентный продюсер. Что происходит при acks=1 и падении лидера.
- Партиции: порядок гарантирован только внутри партиции; ключ определяет порядок и распределение; перекос ключей даёт горячую партицию.
- Параллелизм потребителей ограничен числом партиций. Если добавление потребителей не помогает, причина в партициях, в медленной обработке или в блокирующем вызове.
- Сохранение порядка при параллельной обработке: параллелизм по ключу, а не по сообщению.
- Ошибки обработки: poison message, retry-топики с задержкой, DLQ, обязательный мониторинг DLQ и процедура повторной обработки.
- Эволюция схем событий: обратная совместимость, реестр схем, версии, миграция потребителей по очереди.
- Lag потребителей как главный индикатор здоровья; rebalance как причина пауз.
- Расчёт ёмкости: пропускная способность на партицию, число партиций с запасом, retention и объём диска, репликация.
- Событийная архитектура усложняет отладку и порядок; сквозной идентификатор корреляции обязателен.

**На чём валятся**

- Говорят «Kafka гарантирует exactly-once» без условий.
- Не знают, что порядок только внутри партиции.
- Одно битое сообщение останавливает обработку, а DLQ не мониторится.

## Надёжность: отказы, ретраи, backpressure, деградация

```yaml
slug: nadezhnost-otkazy-retrai-backpressure
questions: system-design-kak-obespechit-high-availability, system-design-senior-kak-postroit-sistemu-perezhivayuschuyu-nedostupnost-postgresql-v-teche, distributed-systems-chto-takoe-retry-storm-i-kak-ego-predotvratit-so-storony-servisa-i-kli, distributed-systems-kak-retry-bez-jitter-sozdaet-lavinu-zaprosov-i-kak-proektirovat-povtor, distributed-systems-kak-ustroen-backpressure-v-raspredelennoi-sisteme-i-chto-delat-kogda-o, distributed-systems-kak-otlichit-medlennyi-servis-ot-upavshego-i-pochemu-eto-principialno, distributed-systems-chto-takoe-gray-failure-i-pochemu-health-check-ego-ne-zamechaet, distributed-systems-kak-sproektirovat-timeout-budget-dlya-cepochki-iz-pyati-servisov, microservices-advanced-kak-kombinirovat-circuit-breaker-retry-i-timeout-chtoby-oni-ne-konflik, microservices-advanced-kak-vybrat-porog-dlya-circuit-breaker-i-chto-proizoidet-pri-nevernoi-n
articles: retry-jitter-i-retry-storm, timeout-budget, circuit-breaker, backpressure, gray-failure-i-health-checks
puzzles:
```

**Что нужно знать**

- Доступность считается арифметикой: цепочка из N последовательных зависимостей перемножает доступности: 5 зависимостей по 99,9% дают около 99,5%, то есть около 44 часов простоя в год; 99,99% это около 52 минут в год.
- Устранение единых точек отказа: резервирование на каждом уровне, размещение по нескольким зонам, проверка, что отказ зоны реально переживается.
- Таймауты везде и согласованные: общий бюджет запроса, дедлайны, передаваемые вниз по цепочке; таймаут вызываемого меньше таймаута вызывающего.
- Ретраи: только идемпотентные операции, экспоненциальная задержка с джиттером, ограничение числа и общая доля (retry budget). Ретраи на нескольких уровнях перемножаются.
- Retry storm: рост нагрузки на уже перегруженный сервис. Защита: джиттер, retry budget, circuit breaker, ограничение на стороне сервера.
- Circuit breaker: состояния, порог по доле ошибок и объёму, время в open, пробные запросы; как он сочетается с ретраем и таймаутом.
- Backpressure: сервис сообщает «перегружен» (429, 503, ограниченные очереди), а не наращивает неограниченную очередь. Load shedding по приоритету.
- Bulkhead: изоляция пулов ресурсов, чтобы одна зависимость не съела все потоки.
- Gray failure: узел жив по health check, но медленный или отдаёт ошибки части запросов. Нужны проверки по реальным метрикам, а не только ping.
- Деградация: что отключаем в первую очередь, что отдаём из кэша, какие функции критичны. Заранее проговариваете этот список.
- Rate limiting: алгоритмы (token bucket, sliding window), лимит на клиента и глобальный, общее состояние в Redis и его цена.
- Контроль нагрузки при восстановлении: плавный прогрев, ограничение скорости догоняющей обработки.

**На чём валятся**

- Включают ретраи на всех уровнях без бюджета и усиливают собственный сбой.
- Health check возвращает 200, пока сервис фактически не работает.
- Нет плана деградации: при отказе зависимости падает всё.

## Наблюдаемость, SLO и эксплуатация

```yaml
slug: nablyudaemost-slo-ekspluataciya
questions: system-design-kak-obespechit-observability, devops-senior-chto-dolzhno-popadat-v-metriki-a-chto-v-logi-i-pochemu-eto-raznye-inst, devops-senior-kak-vybrat-sli-i-slo-dlya-servisa-i-chto-delat-pri-ischerpanii-error-b, devops-senior-kakie-alerty-deistvitelno-nuzhny-i-kak-izbezhat-ustalosti-ot-opovesche, devops-senior-kak-nastroit-opentelemetry-v-net-i-chto-instrumentirovat-v-pervuyu-och, devops-senior-kak-rabotaet-semplirovanie-trassirovok-i-kak-ne-poteryat-redkie-oshibk, devops-senior-kak-svyazat-logi-metriki-i-trassirovki-pri-razbore-incidenta, kafka-kak-monitorit-kafka-consumer-lag, kafka-advanced-consumer-lag-rastet-lineino-kak-naiti-prichinu-i-chto-predprinyat, devops-senior-kak-organizovat-canary-deploi-i-po-kakim-metrikam-prinimat-reshenie-ob
articles: logi-metriki-trassirovki, sli-i-slo, alerty-bez-shuma, semplirovanie-trassirovok, razbor-incidenta, opentelemetry-v-dotnet, rolling-blue-green-canary
puzzles:
```

**Что нужно знать**

- Три сигнала: метрики (что происходит), логи (детали события), трассировки (путь запроса). Каждый отвечает на свой вопрос, связываются через идентификатор трассировки.
- Методики выбора метрик: RED для сервисов (rate, errors, duration), USE для ресурсов (utilization, saturation, errors).
- SLI это измеримый показатель с точки зрения пользователя (доля успешных запросов, p99), SLO это цель, error budget это допустимая доля нарушений.
- Расход error budget управляет решениями: при исчерпании замораживаются релизы и выделяется время на надёжность.
- Алерты по симптомам и по скорости сжигания бюджета (burn rate), а не по загрузке CPU. Каждый алерт требует действия и имеет инструкцию.
- Сэмплирование трассировок: head-based простое, но теряет редкие ошибки; tail-based сохраняет медленные и ошибочные трассы ценой буферизации.
- Кардинальность метрик: идентификатор пользователя в label ломает хранилище метрик.
- Мониторинг очередей: lag, возраст самого старого сообщения, размер DLQ.
- Безопасная выкатка: rolling, blue-green, canary; автоматическая остановка по метрикам; откат; совместимость схемы базы с двумя версиями приложения.
- Разбор инцидента: хронология, причины и вклад факторов, действия, без поиска виноватых. Улучшение измеряется тем, как быстро вы обнаружите и откатите в следующий раз.
- Время обнаружения (MTTD) и восстановления (MTTR) как целевые метрики, а не только предотвращение отказов.

**На чём валятся**

- Называют метрики без SLO и не могут сказать, при каком значении сработает алерт.
- Алерты по инфраструктуре, а не по пользовательскому опыту.
- Нет плана отката и проверки релиза на малой доле трафика.

## Масштабирование и эволюция архитектуры

```yaml
slug: masshtabirovanie-i-evolyuciya-arhitektury
questions: system-design-senior-kak-sistema-dolzhna-vesti-sebya-pri-desyatikratnom-roste-nagruzki-za-c, system-design-senior-kak-sproektirovat-geo-raspredelennuyu-sistemu-dlya-polzovatelei-na-raz, system-design-senior-kak-sproektirovat-active-active-v-dvuh-regionah-i-kak-reshat-konflikty, system-design-senior-chto-takoe-rto-i-rpo-i-kak-vybrannye-znacheniya-menyayut-arhitekturu, system-design-senior-kak-splanirovat-disaster-recovery-i-chto-dolzhno-proizoiti-pri-potere, system-design-senior-kak-proverit-chto-plan-vosstanovleniya-rabotaet-ne-ustroiv-avariyu-v-p, microservices-advanced-kak-opredelit-granicy-servisov-cherez-ddd-i-kakie-priznaki-govoryat-ob, microservices-advanced-kak-splanirovat-raspil-monolita-i-s-chego-nachat-v-pervuyu-ochered, microservices-advanced-kak-rabotaet-strangler-fig-na-praktike-i-kak-marshrutizirovat-trafik-v, microservices-advanced-kak-razdelit-obschuyu-bazu-dannyh-pri-vydelenii-servisa-iz-monolita
articles: rto-rpo-i-disaster-recovery, ms-granicy-servisov, sinhronnoe-vs-asinhronnoe-vzaimodeystvie, ms-versionirovanie-kontraktov
puzzles:
```

**Что нужно знать**

- Эволюция по этапам: монолит и одна база, реплики и кэш, очередь и воркеры, выделение сервисов, шардирование, несколько регионов. Каждый переход вызван конкретным ограничением.
- Рост в 10 раз: где первое узкое место, что можно решить конфигурацией и кэшем, что требует архитектурных изменений, что нужно проверить нагрузочным тестом.
- Автомасштабирование: метрика-триггер, время прогрева, ограничение сверху (чтобы не уничтожить зависимости), холодный старт, стоимость.
- Гео-распределение: ближайший регион по задержке, размещение данных (требования к локализации), маршрутизация пользователей, поведение при потере региона.
- Active-active: конфликты записи, стратегии (home region, LWW, CRDT, слияние на приложении), цена в консистентности и сложности. Active-passive проще, но дольше восстановление.
- RTO и RPO: цели по времени восстановления и допустимой потере данных. Они определяют архитектуру: холодный, тёплый, горячий резерв, тип репликации.
- Disaster recovery проверяется учениями: восстановление из бэкапа, переключение региона, game day. Непроверенный бэкап это не бэкап.
- Границы сервисов по предметной области и владению данными, а не по слоям. Признаки неверных границ: распределённые транзакции на каждую операцию, общая база, каскадные релизы.
- Распил монолита: strangler fig, маршрутизация трафика по частям, выделение данных последним шагом, анти-коррупционный слой.
- Контракты между сервисами: обратная совместимость, версии API и событий, контрактные тесты.
- Стоимость: межзонный трафик, хранение, избыточность. Сознательно выбирайте, где платите за надёжность, а где нет.

**На чём валятся**

- Сразу проектируют финальную архитектуру без пути развития.
- Active-active без ответа на вопрос о конфликтах записи.
- Называют RPO и RTO, но не связывают их с выбором репликации и бэкапов.

## Разборы senior-задач

```yaml
slug: razbory-senior-zadach
questions: system-design-sproektirovat-sistemu-massovoi-rassylki, system-design-sproektirovat-sistemu-rekomendacii, system-design-senior-sproektiruite-otkazoustoichivyi-servis-uvedomlenii-s-prioritetami, system-design-senior-sproektiruite-sistemu-otslezhivaniya-posylok-na-10-millionov-sobytii-v, system-design-senior-kak-sproektirovat-hranenie-i-razdachu-polzovatelskih-failov-na-petabai, microservices-advanced-kogda-cqrs-opravdan-i-kakuyu-slozhnost-on-prinosit, microservices-advanced-kak-borotsya-s-zaderzhkoi-sinhronizacii-read-modeli-v-cqrs, microservices-advanced-kogda-event-sourcing-deistvitelno-nuzhen-i-pochemu-ego-chasto-vnedryay, microservices-advanced-chto-dolzhen-i-chego-ne-dolzhen-delat-api-gateway
articles: notification-service, otslezhivanie-posylok, file-storage, url-shortener, sistema-na-100000-rps, cqrs-razdelenie-komand-i-zaprosov
puzzles:
```

**Что нужно знать**

- Единый каркас разбора: требования, оценки, API и данные, схема, deep dive, отказы, эволюция. Тренируйте его на разных задачах, пока он не станет автоматическим.
- Лента новостей: fan-out on write для обычных пользователей, fan-out on read для знаменитостей, гибрид, хранение ленты в кэше, холодный старт.
- Мессенджер: доставка at-least-once с идемпотентностью по идентификатору сообщения, порядок внутри чата, подтверждения, соединения (WebSocket) и их масштабирование, офлайн-очередь.
- Платежи и леджер: двойная бухгалтерская запись (double-entry), неизменяемость, идемпотентные ключи, сверка, обработка неопределённых статусов.
- Такси: геоиндекс (geohash, S2, H3), поток координат через лог событий, матчинг и блокировка водителя от двойного назначения, горячие районы.
- Distributed rate limiter: token bucket в Redis, атомарность через Lua, приближённый счёт на узлах, поведение при недоступности хранилища (fail open или fail closed).
- Уведомления: приоритеты и отдельные очереди, дедупликация, ограничение частоты по пользователю, повторы с джиттером, каналы с разными провайдерами и деградацией.
- Поиск и typeahead: инвертированный индекс, обновление индекса из лога изменений, префиксные структуры, кэш популярных префиксов.
- Рекомендации: офлайн-расчёт кандидатов и онлайн-ранжирование, хранилище признаков, холодный старт, деградация до популярного при отказе модели.
- Сокращатель ссылок на senior-уровне: генерация идентификаторов без координации, кэш горячих ссылок, аналитика переходов асинхронно через очередь.
- Видео: загрузка по частям, транскодирование очередью задач, адаптивный битрейт, CDN, стоимость хранения и трафика как главная статья.
- CQRS оправдан, когда модели чтения и записи сильно различаются; цена: лаг read-модели и дублирование. Event sourcing оправдан для аудита и восстановления состояния, но усложняет схему событий.
- API gateway отвечает за маршрутизацию, аутентификацию, лимиты; бизнес-логика в нём это ошибка.
- В каждой задаче вы называете главный инвариант, главный риск и один компромисс, на который идёте сознательно.

**На чём валятся**

- Нарисовали типовую схему и не нашли в задаче специфичного узла (знаменитости в ленте, неопределённый ответ провайдера платежа).
- Описали счастливый путь и не дошли до отказов.
- Не уложились во время и не успели ни deep dive, ни эволюцию.
