---
title: Backend .NET — Junior
slug: backend-junior
role: backend
roleName: Backend .NET
level: junior
sortOrder: 0
summary: План подготовки к первому собеседованию на Junior Backend .NET: какие основы C#, ООП, коллекций, async, ASP.NET Core, EF Core, SQL и алгоритмов проверяют и в каком порядке их прорабатывать по вопросам, статьям и задачам.
---

# Вступление

Гайд для тех, кто ищет первую работу backend-разработчиком на .NET или работает до полутора лет и хочет закрепить базу перед собеседованием. Подойдёт выпускникам курсов и вузов, стажёрам и разработчикам, которые переходят в .NET из другого языка.

От Junior не ждут опыта прода и архитектурных решений. Ждут, что вы знаете основы и понимаете написанный код: можете прочитать метод и объяснить, что он делает, предсказать результат простого фрагмента, найти очевидную ошибку и сказать, почему она ошибка. Middle отвечает «как это работает и чем придётся заплатить», Junior отвечает «что это такое, зачем нужно и как этим правильно пользоваться».

Конкретно это значит:

- уверенно знать синтаксис и систему типов C#: value и reference types, классы и структуры, строки, исключения, null;
- понимать ООП не по определениям, а на примерах: зачем интерфейс, что такое полиморфизм, когда наследование уместно;
- выбирать подходящую коллекцию и писать простые LINQ-запросы, понимая, когда они выполняются;
- знать, зачем нужен `async/await`, и не делать грубых ошибок вроде `async void` и `.Result`;
- понимать HTTP и REST: методы, статус-коды, заголовки, JSON;
- собрать простой Web API на ASP.NET Core: контроллер или Minimal API, DI, middleware на базовом уровне;
- работать с базой через EF Core и писать на SQL запросы с `JOIN`, `GROUP BY`, понимать, зачем индексы и транзакции;
- пользоваться Git в команде и писать простые unit-тесты;
- решать простые алгоритмические задачи и называть их сложность.

**Как пользоваться гайдом**

- Темы идут в порядке изучения: язык, коллекции, async, веб, данные, инструменты, алгоритмы. Не перескакивайте: без понимания reference types не получится объяснить DI, а без LINQ не получится EF Core.
- В каждой теме сначала прочитайте «Что нужно знать» и отметьте пункты, которые можете объяснить вслух своими словами. Затем идите по вопросам сверху вниз: они упорядочены от простых к сложным. Последние вопросы в списке уже ближе к Middle, на них достаточно общего понимания.
- Каждое утверждение проверяйте кодом. Откройте консольный проект, напишите три строки, запустите, посмотрите результат. Для Junior это самый быстрый способ перестать путаться.
- Решайте задачи «что выведет код» без запуска, потом сверяйтесь. Это ровно тот формат, который дают на скрининге.
- Бюджет времени: 4–8 недель при 1–2 часах в день. Четырёх недель хватит, если вы уже писали учебный Web API с базой. Восемь недель нужны, если C# изучен по курсу, а SQL, Git и алгоритмы почти не трогали.
- Параллельно с теорией сделайте один небольшой проект и выложите на GitHub: Web API на ASP.NET Core, EF Core, PostgreSQL, пара тестов, README с инструкцией запуска. Для Junior без опыта это главный аргумент в резюме и источник ответов на вопрос «расскажите о своём проекте».

**Какой глубины достаточно**

Достаточно уровня «объясню своими словами и покажу на коротком примере». Для async/await это означает: понимаю, что `await` освобождает поток на время ожидания ввода-вывода, знаю, почему `async void` и `.Result` опасны, умею прокинуть `CancellationToken`. Не нужно рассказывать устройство state machine или `SynchronizationContext` во всех деталях. Если интервьюер копает глубже, честно скажите, где ваша граница, и порассуждайте вслух. За «не знаю, но предположу так, потому что…» Junior не наказывают, за уверенную выдумку наказывают.

# Формат собеседования

Процесс найма Junior обычно длиннее по числу кандидатов, но проще по этапам: 2–4 шага за 1–4 недели. Конкурс высокий, поэтому многое решают тестовое задание и первые минуты разговора.

**1. HR или скрининг, 15–30 минут.** Мотивация, почему .NET, чем занимались, ожидания по деньгам и формату, иногда английский. Иногда сюда добавляют 5–10 коротких технических вопросов: «чем класс отличается от структуры», «что такое `Dictionary`», «какие HTTP-методы знаете». Готовьте рассказ о себе на 1–2 минуты: учёба или прошлая профессия, что изучали, какой проект сделали, что в нём было самым сложным.

**2. Тестовое задание, от нескольких часов до нескольких дней.** Частый этап именно на Junior. Типичный вариант: небольшой Web API (CRUD с базой, валидация, пара эндпоинтов с фильтрацией), иногда консольная утилита или алгоритмическая задача. Оценивают не объём, а аккуратность: структура проекта, понятные имена, обработка ошибок, README с инструкцией запуска, отсутствие закоммиченных `bin/obj` и паролей, хотя бы несколько тестов. Не добавляйте микросервисы и паттерны ради впечатления: лишняя сложность читается как непонимание задачи.

**3. Техническое интервью, 45–90 минут.** Вопросы по C#, ООП, коллекциям, LINQ, async, ASP.NET Core, EF Core, SQL. Идут от простого к сложному, пока не найдут границу. Часто дают фрагмент кода и спрашивают, что он выведет или где ошибка. Если было тестовое, начинают с его разбора: почему так спроектировали, что бы улучшили, как бы добавили новую фичу. Будьте готовы объяснить каждую строку своего тестового.

**4. Live coding, 30–60 минут.** На Junior задачи проще, чем на Middle: развернуть строку, найти дубликаты, проверить скобки, two sum, посчитать частоты слов, написать простой LINQ-запрос или SQL-запрос по двум таблицам. Проверяют, что вы умеете писать код без IDE-подсказок, говорите вслух и проверяете решение на примерах.

**5. Финальный разговор с тимлидом, 30–45 минут.** Насколько вы обучаемы и как работаете с обратной связью. Типичные вопросы: что изучали последним и как, как ищете решение, когда застряли, как реагируете на критику на code review, какая ошибка научила вас больше всего. Отвечайте по STAR: ситуация, задача, действие, результат.

**Чем Junior отличается от Middle в глазах интервьюера**

- Junior знает определения и может проиллюстрировать их примером. Middle объясняет причины и последствия. На Junior достаточно «`Scoped` живёт в пределах одного HTTP-запроса», от Middle ждут «почему нельзя внедрить `Scoped` в `Singleton`».
- От Junior не ждут опыта прода, но ждут понимания своего кода. Самый плохой сигнал: кандидат не может объяснить, что делает строка из его же тестового.
- Junior может не знать ответа, но должен показать, как будет его искать: документация, отладчик, маленький эксперимент.
- Главное, что оценивают: обучаемость и аккуратность. Кандидата, который честно говорит о пробелах и быстро соображает на подсказках, берут охотнее, чем того, кто выучил больше определений.

**Типичные ошибки**

- Заучивание определений без понимания. Первый уточняющий вопрос («а покажите на примере») обрушивает ответ.
- Резюме, перегруженное технологиями: Kafka, Kubernetes, микросервисы, Redis после двухмесячного курса. Спросят про каждую.
- Молчание на live coding. Интервьюер не видит хода мысли, и даже правильное решение получает низкую оценку.
- Код сразу, без уточнения условий и без проверки на примере.
- Неряшливое тестовое: нет README, не запускается с первого раза, строка подключения с паролем в репозитории, весь код в `Program.cs`.
- Выдумывание ответа вместо «не уверен».
- Отсутствие вопросов к компании в конце.

**Как отвечать**

- Структура ответа: что это в одну фразу, зачем нужно, короткий пример, частая ошибка. «`using` нужен для гарантированного вызова `Dispose`. Компилятор разворачивает его в `try/finally`. Например, для `FileStream` или `DbConnection`. Если забыть, соединение вернётся в пул только после сборки мусора или не вернётся вовсе».
- Если не знаете точно, скажите, что знаете, и как бы проверили: «Думаю, что `First` бросит исключение на пустой последовательности, а `FirstOrDefault` вернёт `default`. Проверил бы в консоли».
- На задачах на код сначала проговорите пример и граничные случаи (пустой вход, один элемент, `null`), потом решение, потом прогоните его вручную и назовите сложность.
- Ссылайтесь на свой проект: «в моём пет-проекте я зарегистрировал `DbContext` через `AddDbContext`, он по умолчанию `Scoped`».

**Вопросы, которые стоит задать компании**

- Как устроен онбординг и есть ли ментор у новичка?
- Как выглядят первые задачи Junior и через сколько времени он обычно берёт задачи самостоятельно?
- Как проходит code review и сколько в команде разработчиков?
- Какой стек и версия .NET, есть ли тесты и CI?
- Что нужно показать за испытательный срок, чтобы его успешно пройти?

## Основы C# и система типов

```yaml
slug: csharp-basics
questions: clr-gc-chto-takoe-clr, clr-gc-chto-proishodit-s-c-kodom-ot-kompilyacii-do-vypolneniya, csharp-chto-takoe-value-type-i-reference-type, csharp-chem-class-otlichaetsya-ot-struct, csharp-gde-hranyatsya-value-types-i-reference-types-v-stack-ili-heap, csharp-chem-otlichayutsya-const-readonly-i-static-readonly, csharp-chto-delayut-ref-out-i-in, csharp-chto-takoe-boxing-i-unboxing, csharp-chem-otlichayutsya-equals-referenceequals-i, csharp-dlya-chego-nuzhen-gethashcode, csharp-chem-otlichayutsya-record-class-i-struct
articles: value-type-i-reference-type, stek-i-kucha, class-struct-record, upakovka-i-raspakovka, equals-gethashcode-operator, cs-ref-const-virtual-extension
puzzles: peredacha-struct-i-class-v-metod, upakovka-i-sravnenie, perepolnenie-pri-umnozhenii
```

**Что нужно знать**

- Что такое .NET, CLR и сборка: C# компилируется в IL, при запуске JIT переводит IL в машинный код. Чем .NET отличается от .NET Framework на уровне «кроссплатформенный, современный, развивается».
- Встроенные типы: `int`, `long`, `double`, `decimal`, `bool`, `char`, `string`, `object`. Почему деньги хранят в `decimal`, а не в `double` (`0.1 + 0.2 != 0.3` у `double`).
- Value types (`int`, `bool`, `DateTime`, любые `struct`, `enum`) хранят само значение. Reference types (`class`, `string`, массивы, делегаты) хранят ссылку на объект в куче.
- Главное следствие: при присваивании и передаче в метод структура копируется целиком, а у класса копируется только ссылка, и обе переменные смотрят на один объект.
- «Структуры всегда в стеке» — упрощение. Локальная переменная-структура действительно обычно в стеке, но структура-поле класса живёт внутри объекта в куче.
- Класс и структура: наследование (у структур нет), значение по умолчанию (`null` против нулевых полей), когда выбирать структуру (маленький неизменяемый тип вроде координаты).
- `const`, `readonly`, `static readonly`: константа времени компиляции, поле, которое задаётся один раз в конструкторе, и поле на весь тип.
- `ref` и `out`: передача переменной по ссылке; `out` обязан присвоить значение (пример: `int.TryParse(s, out var n)`).
- Boxing: упаковка значения в объект при приведении к `object` или интерфейсу. Почему это лишние аллокации и почему `List<int>` лучше `ArrayList`.
- Сравнение: `==` для классов по умолчанию сравнивает ссылки, для `string` переопределён и сравнивает содержимое. `Equals`, `ReferenceEquals`.
- `GetHashCode` нужен для `Dictionary` и `HashSet`. Правило: переопределил `Equals` — переопределяй `GetHashCode`.
- `record`: тип с равенством по значению, удобным `ToString` и `with`-выражением для копии с изменениями.
- Модификаторы доступа: `public`, `private`, `protected`, `internal`. Свойства и поля: зачем свойства (`get; set;`, `init`), автосвойства.
- `var` — это не динамическая типизация: тип выводится компилятором и дальше не меняется.
- Целочисленное переполнение по умолчанию не бросает исключение: `int.MaxValue + 1` даёт отрицательное число. `checked` включает проверку.

**На чём валятся**

- Говорят «класс в куче, структура в стеке» и теряются на вопросе про поле-структуру внутри класса.
- Не могут предсказать, изменится ли объект после передачи в метод, особенно если внутри метода переменной присвоили `new`.
- Путают `==` и `Equals` для строк и для своих классов.
- Хранят деньги в `double` и не знают, почему это плохо.
- Считают `var` аналогом `dynamic` или `object`.

## ООП и SOLID на базовом уровне

```yaml
slug: oop-solid
questions: csharp-chto-takoe-inkapsulyaciya-nasledovanie-polimorfizm-i-abstrakciya, csharp-chem-interface-otlichaetsya-ot-abstract-class, csharp-chto-delayut-virtual-override-i-new, csharp-chto-takoe-solid, architecture-patterns-kak-vybrat-mezhdu-factory-i-pryamym-konstruktorom, architecture-patterns-kogda-strategy-luchshe-konstrukcii-switch-i-kogda-naoborot
articles: inkapsulyaciya-nasledovanie-polimorfizm, solid-po-principam, pattern-factory, strategy-vs-switch
puzzles: sokrytie-metoda-cherez-new
```

**Что нужно знать**

- Инкапсуляция: объект сам отвечает за свои данные и не даёт привести их в неверное состояние. Пример: у `Order` нельзя напрямую поставить `Total`, он считается из позиций; приватное поле с публичным методом вместо публичного сеттера.
- Наследование: переиспользование и расширение поведения базового класса. Ограничения в C#: один базовый класс, но сколько угодно интерфейсов.
- Полиморфизм: один вызов, разное поведение. Пример: `IPaymentProvider.Pay()` с реализациями для карты и для СБП, код вызывающей стороны не меняется.
- Абстракция: работать с сущностью через минимально нужный контракт, не зная деталей реализации.
- Интерфейс против абстрактного класса: интерфейс задаёт контракт без состояния, абстрактный класс может хранить состояние и общую реализацию. Класс реализует много интерфейсов, но наследует один класс.
- `virtual` и `override`: метод можно переопределить в наследнике, вызов через базовый тип пойдёт в версию наследника. `new` скрывает метод, и через базовый тип вызовется базовая версия. `abstract` обязывает наследника реализовать метод. `sealed` запрещает дальнейшее наследование.
- Композиция предпочтительнее наследования: «имеет» вместо «является». Пример плохого наследования: `Square : Rectangle`.
- SOLID одной фразой на каждую букву и одним примером:
  - S — у класса одна причина для изменения (не смешивать в одном классе расчёт и отправку email);
  - O — расширяем поведение добавлением нового класса, а не правкой старого `switch`;
  - L — наследника можно подставить вместо базового класса без сюрпризов;
  - I — несколько узких интерфейсов лучше одного «толстого»;
  - D — зависим от абстракций, конкретную реализацию передаёт DI-контейнер.
- Базовые паттерны, которые встречаются в любом проекте: Factory, Strategy, Repository, Singleton (и почему в ASP.NET Core его заменяет время жизни `Singleton` в DI).
- Статические классы и методы: когда уместны (чистые утилиты) и почему мешают тестированию, если внутри есть зависимости.

**На чём валятся**

- Называют четыре принципа ООП определениями из учебника, но не могут привести пример из своего кода.
- Не могут ответить, что выведет вызов метода через переменную базового типа при `override` и при `new`.
- Перечисляют SOLID по буквам, но не показывают нарушение ни одного принципа.
- Отвечают «абстрактный класс — это интерфейс с реализацией» и не упоминают состояние и множественную реализацию интерфейсов.

## Строки, исключения, null и ресурсы

```yaml
slug: strings-exceptions-null
questions: csharp-pochemu-string-immutable, csharp-chem-otlichayutsya-string-i-stringbuilder, csharp-chto-takoe-immutable-object-i-zachem-on-nuzhen, csharp-chto-takoe-nullable-reference-types, clr-gc-chto-takoe-idisposable, clr-gc-zachem-nuzhen-dispose, clr-gc-kak-rabotaet-using, clr-gc-kak-rabotaet-garbage-collector, clr-gc-mozhet-li-managed-prilozhenie-imet-memory-leak
articles: stroki-i-stringbuilder, nullable-reference-types, idisposable-using-finalizatory, kak-rabotaet-gc
puzzles: sborka-stroki-v-cikle, nullable-i-operator-coalesce, izmenenie-peremennoj-v-finally, poryadok-dispose-vo-vlozhennyh-using
```

**Что нужно знать**

- Строка неизменяема: любая «модификация» (`+`, `Replace`, `ToUpper`) создаёт новую строку. Поэтому конкатенация в цикле стоит O(n²) по копированию, и для неё нужен `StringBuilder` или `string.Join`.
- Интерполяция `$"..."`, `string.Format`, `string.IsNullOrEmpty` и `string.IsNullOrWhiteSpace`. Сравнение строк без учёта регистра: `string.Equals(a, b, StringComparison.OrdinalIgnoreCase)` вместо `a.ToLower() == b.ToLower()`.
- Исключения: `try`, `catch`, `finally`, `throw`. `finally` выполняется и при нормальном выходе, и при исключении, и при `return`.
- `throw;` против `throw ex;`: первый сохраняет исходный стек вызовов, второй его теряет.
- Какие исключения ловить: конкретные (`FormatException`, `KeyNotFoundException`), а не `catch (Exception)` с пустым телом. Исключение — для исключительных ситуаций, а не для обычного ветвления логики: для разбора ввода есть `TryParse`.
- Иерархия на уровне «все наследуют `Exception`», частые типы: `ArgumentNullException`, `ArgumentException`, `InvalidOperationException`, `NullReferenceException`, `KeyNotFoundException`.
- Null: откуда берётся `NullReferenceException`, операторы `?.`, `??`, `??=`. Nullable value types (`int?`, `HasValue`, `Value`).
- Nullable reference types (`string?`): это предупреждения компилятора, а не проверки во время выполнения. Оператор `!` только глушит предупреждение.
- Сборщик мусора на уровне идеи: освобождает объекты, на которые больше нет ссылок; вызывать `GC.Collect()` вручную не нужно.
- Утечки памяти в .NET возможны: статическая коллекция, в которую только добавляют, неотписанное событие.
- `IDisposable` и `using`: детерминированное освобождение ресурсов, которыми GC не управляет (файлы, соединения с БД, сокеты). `using` разворачивается в `try/finally` с вызовом `Dispose`. Вложенные `using` освобождаются в обратном порядке.

**На чём валятся**

- Склеивают строку в цикле через `+=` и не могут объяснить, почему это медленно.
- Пишут `catch (Exception) { }` и «проглатывают» ошибки.
- Используют `throw ex;` и не знают, что теряется стек вызовов.
- Считают, что включённые nullable reference types гарантируют отсутствие `null` в рантайме.
- Говорят, что в .NET утечек памяти не бывает, потому что есть GC.
- Путают `Dispose` с удалением объекта из памяти.

## Коллекции, делегаты и LINQ

```yaml
slug: collections-linq
questions: csharp-chem-array-otlichaetsya-ot-list-t, csharp-chem-otlichayutsya-ienumerable-icollection-i-ilist, csharp-kak-rabotaet-dictionary, csharp-kak-rabotaet-hashset, algorithms-kogda-ispolzovat-dictionary-a-kogda-hashset, csharp-chem-otlichayutsya-action-func-i-predicate, csharp-chto-takoe-lambda-expression, csharp-chto-takoe-extension-methods, csharp-chto-takoe-linq-i-kak-on-vypolnyaetsya, csharp-chto-takoe-deferred-execution, csharp-chem-otlichayutsya-first-firstordefault-single-i-singleordefault
articles: array-vs-list, ienumerable-icollection-ilist, kak-ustroen-dictionary, hashset, vybor-kollekcii, linq-i-otlozhennoe-vypolnenie
puzzles: povtornoe-perechislenie-linq, zamykanie-v-cikle-for
```

**Что нужно знать**

- Массив: фиксированный размер, доступ по индексу за O(1). `List<T>`: массив, который сам растёт; `Add` в среднем O(1), вставка и удаление в середине O(n), поиск `Contains` O(n).
- `Dictionary<TKey, TValue>`: поиск, добавление и удаление по ключу в среднем за O(1). Ключи уникальны; обращение `dict[key]` к отсутствующему ключу бросает `KeyNotFoundException`, поэтому используют `TryGetValue`.
- `HashSet<T>`: уникальные элементы и быстрая проверка `Contains`. Когда `HashSet`, когда `Dictionary`: нужно ли хранить значение при ключе.
- `Queue<T>` (первым пришёл, первым ушёл) и `Stack<T>` (последним пришёл, первым ушёл): где применяются.
- Интерфейсы `IEnumerable<T>` (можно перебрать), `ICollection<T>` (плюс `Count`, `Add`), `IList<T>` (плюс индекс). Что принимать в параметрах метода, если нужен только перебор.
- Нельзя менять коллекцию внутри `foreach` по ней: получите `InvalidOperationException`.
- Делегаты на базовом уровне: переменная, хранящая метод. `Action` (без результата), `Func` (с результатом), `Predicate<T>` (возвращает `bool`). Лямбда — короткая запись анонимного метода.
- Замыкание: лямбда захватывает переменную, а не её значение на момент создания. Классическая ловушка с переменной цикла `for`.
- Методы расширения: статический метод с `this` у первого параметра. Весь LINQ сделан именно так.
- LINQ: `Where`, `Select`, `OrderBy`, `GroupBy`, `Any`, `All`, `Count`, `Sum`, `First`, `ToList`, `ToDictionary`.
- Отложенное выполнение: `Where` и `Select` ничего не делают, пока результат не перебрали. `ToList`, `Count`, `First`, `foreach` запускают выполнение. Каждый повторный перебор выполняет запрос заново.
- `First` и `Single` бросают исключение, если элемента нет; `Single` также бросает, если элементов больше одного. Версии `OrDefault` возвращают `default`.
- `Any()` вместо `Count() > 0` для проверки непустоты.

**На чём валятся**

- Используют `List.Contains` в цикле для проверки дубликатов и получают O(n²) там, где нужен `HashSet`.
- Не могут объяснить, почему LINQ-запрос выполнился дважды или не выполнился вовсе.
- Выбирают `Single` там, где нужен `First`, или наоборот, и не знают, что каждый бросает.
- Удаляют элементы из списка внутри `foreach` и удивляются исключению.
- Не понимают, что выведет код с лямбдами, захватившими переменную цикла `for`.

## Основы async/await и потоков

```yaml
slug: async-basics
questions: async-chto-takoe-task, async-kak-rabotaet-async-await, async-sozdaet-li-async-await-novyi-potok, async-chto-takoe-cpu-bound-i-io-bound-operacii, async-chto-budet-esli-zabyt-await, async-pochemu-async-void-obychno-ispolzovat-ne-rekomenduetsya, async-chto-delaet-task-whenall, async-kak-obrabatyvayutsya-isklyucheniya-v-async-metodah, async-kak-rabotaet-cancellationtoken, async-chto-takoe-deadlock-pri-ispolzovanii-async-await, multithreading-chto-takoe-race-condition, multithreading-chto-delaet-lock
articles: kak-rabotaet-async-await, task-vs-thread-vs-valuetask, async-void, cancellationtoken-i-taymauty, race-condition
puzzles: async-sinhronnaya-chast-metoda, async-void-isklyuchenie, async-dedlok-result, mnogopotochnost-gonka-na-inkremente, mnogopotochnost-vlozhennyj-lock
```

**Что нужно знать**

- Зачем асинхронность на сервере: пока запрос ждёт базу или внешний API, поток не простаивает и может обслуживать другие запросы. Это про масштабируемость, а не про ускорение одного запроса.
- `Task` и `Task<T>`: обещание результата, который появится позже. Это не поток.
- `async` разрешает использовать `await` внутри метода. `await` ждёт завершения задачи, не блокируя поток, и продолжает выполнение метода после неё.
- `async/await` сам по себе не создаёт новых потоков. Код до первого `await` выполняется синхронно в вызывающем потоке.
- IO-bound (база, сеть, файлы) и CPU-bound (вычисления) операции. Для IO используются асинхронные методы библиотек (`ToListAsync`, `GetAsync`), `Task.Run` для них не нужен.
- Правила для повседневного кода: асинхронность «до самого верха», методы с суффиксом `Async`, возвращать `Task`, а не `void`.
- `async void` допустим только в обработчиках событий: исключение из него нельзя поймать снаружи, и оно может уронить процесс.
- Забытый `await`: метод продолжает работу, не дождавшись результата, исключение теряется.
- `.Result` и `.Wait()` блокируют поток. В UI и старом ASP.NET это приводило к дедлоку, в ASP.NET Core — к нехватке потоков под нагрузкой. Правило: не смешивать синхронное ожидание с async.
- `Task.WhenAll` для параллельного запуска независимых операций, например трёх HTTP-запросов.
- `CancellationToken`: отмена по запросу. В ASP.NET Core токен приходит в action и прокидывается дальше в EF Core и `HttpClient`.
- Минимум про потоки: что такое поток и пул потоков, что такое гонка данных на примере `counter++` из нескольких потоков, как её исправить через `lock` или `Interlocked.Increment`.

**На чём валятся**

- Говорят, что `await` запускает код в новом потоке.
- Пишут `async void` в обычных методах и не понимают, почему исключение не ловится.
- Вызывают `.Result` «чтобы не переделывать метод на async».
- Оборачивают вызов базы в `Task.Run`, считая, что так он станет асинхронным.
- Не могут объяснить, почему `counter++` из двух потоков даёт результат меньше ожидаемого.

## HTTP, REST и основы веба

```yaml
slug: http-rest
questions: aspnet-core-chto-takoe-rest, aspnet-core-kakie-http-methods-yavlyayutsya-idempotent, aspnet-core-kakie-http-status-codes-nuzhno-znat-backend-razrabotchiku, system-design-kak-sproektirovat-rest-api, aspnet-core-authentication-vs-authorization, aspnet-core-kak-rabotaet-jwt-authentication, aspnet-core-chto-takoe-cors, aspnet-core-chto-takoe-csrf
articles: aspnet-dizayn-api-i-versionirovanie, aspnet-autentifikaciya-i-jwt, aspnet-cors-i-csrf, idempotentnost
puzzles:
```

**Что нужно знать**

- Что происходит, когда браузер открывает адрес: DNS, TCP-соединение, TLS для HTTPS, HTTP-запрос, ответ. Достаточно уровня общей схемы.
- Структура HTTP-запроса и ответа: метод, URL, заголовки, тело; статус-код, заголовки, тело. Важные заголовки: `Content-Type`, `Accept`, `Authorization`, `Cache-Control`.
- HTTP не хранит состояние между запросами. Как сервер «узнаёт» пользователя: cookie или токен в заголовке.
- Методы: `GET` (чтение, без тела), `POST` (создание), `PUT` (полная замена), `PATCH` (частичное изменение), `DELETE`. Безопасные и идемпотентные методы: повторный `PUT` или `DELETE` не меняет результат, повторный `POST` создаст второй объект.
- Статус-коды по группам: 2xx успех, 3xx перенаправление, 4xx ошибка клиента, 5xx ошибка сервера. Наизусть: 200, 201, 204, 400, 401, 403, 404, 409, 500.
- 401 против 403: «мы не знаем, кто вы» против «знаем, но нельзя».
- REST: ресурсы как существительные во множественном числе (`/api/orders/42`), действие задаётся методом, а не URL (`POST /api/orders`, а не `/api/createOrder`). Фильтрация и пагинация через query-параметры.
- JSON как основной формат, сериализация и десериализация (`System.Text.Json`), имена свойств в camelCase.
- Аутентификация (кто вы) и авторизация (что вам можно). JWT на базовом уровне: три части, подпись, срок жизни; токен подписан, но не зашифрован, поэтому секреты в него не кладут.
- HTTPS: зачем шифрование и почему пароль нельзя передавать в query-строке.
- CORS: браузер запрещает фронтенду на одном домене обращаться к API на другом, если сервер явно не разрешил. Это защита браузера, а не сервера.
- Инструменты: Postman или аналог, `curl`, вкладка Network в DevTools, Swagger/OpenAPI.

**На чём валятся**

- Не отличают 401 от 403 и отвечают 200 с текстом ошибки в теле.
- Проектируют API как набор глаголов: `/getUsers`, `/deleteUser?id=5`.
- Считают, что JWT шифрует данные, и кладут в него лишнее.
- Думают, что CORS защищает API от любых чужих запросов, включая запросы из Postman.
- Не могут назвать разницу между `PUT` и `PATCH` или объяснить идемпотентность.

## ASP.NET Core: pipeline, DI и конфигурация

```yaml
slug: aspnet-core-pipeline-di
questions: aspnet-core-chto-takoe-dependency-injection, aspnet-core-chto-takoe-constructor-injection, aspnet-core-chem-otlichayutsya-transient-scoped-i-singleton, aspnet-core-chto-takoe-middleware, aspnet-core-kak-ustroen-request-pipeline-v-asp-net-core, aspnet-core-v-kakom-poryadke-vypolnyayutsya-middleware, aspnet-core-chto-proizoidet-esli-middleware-ne-vyzovet-next, aspnet-core-kak-ustroena-konfiguraciya-asp-net-core, aspnet-core-kak-hranit-secrets-configuration, aspnet-core-kak-rabotaet-logging, aspnet-core-pochemu-nelzya-napryamuyu-vnedryat-scoped-servis-v-singleton
articles: aspnet-di-i-zhiznennye-cikly, aspnet-pipeline-i-middleware, aspnet-konfiguraciya-i-options, aspnet-logirovanie
puzzles: aspnet-core-poryadok-middleware, aspnet-core-captive-dependency
```

**Что нужно знать**

- Что происходит в `Program.cs`: `WebApplication.CreateBuilder`, регистрация сервисов в `builder.Services`, `builder.Build()`, настройка конвейера middleware, `app.Run()`.
- Dependency Injection: класс не создаёт зависимости через `new`, а получает их через конструктор. Зачем: можно подменить реализацию (например, в тестах) и не связывать классы жёстко.
- Регистрация: `AddScoped<IOrderService, OrderService>()`; контейнер сам создаёт объект и передаёт ему зависимости.
- Время жизни: `Transient` — новый экземпляр при каждом запросе к контейнеру, `Scoped` — один на HTTP-запрос, `Singleton` — один на всё приложение. `DbContext` по умолчанию `Scoped`.
- Почему нельзя внедрять `Scoped` в `Singleton`: singleton живёт вечно и удержит один экземпляр scoped-сервиса навсегда. На базовом уровне достаточно понимать проблему и знать, что контейнер в Development ругается на такое на старте.
- Middleware: компонент конвейера, который получает запрос, может что-то сделать до и после следующего компонента или прервать цепочку, не вызвав `next`.
- Порядок важен: обработка исключений первой, затем HTTPS, routing, CORS, аутентификация, авторизация, endpoints. Если `UseAuthorization` стоит до `UseAuthentication`, пользователь всегда будет анонимным.
- Простой собственный middleware: лямбда в `app.Use(async (context, next) => { ...; await next(); ... })`, например для замера времени запроса.
- Конфигурация: `appsettings.json`, `appsettings.Development.json`, переменные окружения; последние перекрывают файлы. Получение значения через `IConfiguration` или привязку к классу (`IOptions<T>`).
- Окружения: `Development`, `Staging`, `Production`, переменная `ASPNETCORE_ENVIRONMENT`.
- Секреты: строку подключения с паролем нельзя коммитить в репозиторий. Для разработки — user secrets, на сервере — переменные окружения или хранилище секретов.
- Логирование через `ILogger<T>`, уровни (`Trace` … `Critical`), шаблон сообщения вместо интерполяции: `logger.LogInformation("Order {OrderId} created", id)`.

**На чём валятся**

- Не могут объяснить, зачем DI, кроме «так принято».
- Путают `Scoped` и `Transient` или не знают, какое время жизни у `DbContext`.
- Не знают, что порядок `Use…` в `Program.cs` влияет на поведение.
- Хранят пароли в `appsettings.json` в публичном репозитории тестового задания.
- Пишут `Console.WriteLine` вместо `ILogger`.

## ASP.NET Core: контроллеры, Minimal API и обработка ошибок

```yaml
slug: aspnet-core-web-api
questions: aspnet-core-chto-takoe-controller, aspnet-core-chto-takoe-minimal-api, aspnet-core-controller-vs-minimal-api, aspnet-core-chto-takoe-routing, aspnet-core-chto-takoe-model-binding, aspnet-core-chto-takoe-model-validation, aspnet-core-chto-takoe-action-filter, aspnet-core-chto-takoe-problemdetails, aspnet-core-kak-globalno-obrabatyvat-isklyucheniya
articles: minimal-api-vs-kontrollery, aspnet-filtry
puzzles:
```

**Что нужно знать**

- Контроллер: класс, наследующий `ControllerBase`, с атрибутами `[ApiController]` и `[Route("api/[controller]")]`; методы-действия с `[HttpGet]`, `[HttpPost]` и так далее.
- Minimal API: `app.MapGet("/orders/{id}", ...)` прямо в `Program.cs` или в группах маршрутов. Чем отличается от контроллеров: меньше церемоний, но структуру и фильтры организуете сами. Для тестового подойдёт любой вариант, если код разложен по файлам.
- Маршрутизация: шаблоны маршрутов, параметры (`{id}`), ограничения (`{id:int}`).
- Model binding: откуда берутся параметры — из маршрута, query-строки, тела (`[FromBody]`), заголовков. С `[ApiController]` сложные типы по умолчанию берутся из тела.
- Возврат результатов: `Ok(...)`, `CreatedAtAction(...)`, `NoContent()`, `NotFound()`, `BadRequest(...)`; в Minimal API — `Results.Ok`, `TypedResults`. `ActionResult<T>` для типизированного ответа.
- DTO вместо сущностей базы в API: не отдавать наружу лишние поля и не принимать на вход то, что пользователь не должен менять.
- Валидация: атрибуты `[Required]`, `[StringLength]`, `[Range]`; с `[ApiController]` невалидная модель автоматически даёт 400 с описанием ошибок. FluentValidation как популярная альтернатива.
- Фильтры на уровне идеи: код до и после действия контроллера (логирование, проверка), отличие от middleware в том, что фильтр работает внутри MVC и знает про конкретное действие.
- Обработка ошибок: не возвращать стек вызовов клиенту, единый формат ошибок `ProblemDetails`, глобальный обработчик (`UseExceptionHandler`) вместо `try/catch` в каждом действии.
- Swagger/OpenAPI для документации и ручной проверки API.
- Асинхронные действия: `async Task<IActionResult>` и `CancellationToken` в параметрах.

**На чём валятся**

- Возвращают сущность EF Core из контроллера и получают циклическую ссылку при сериализации или утечку лишних полей.
- Ставят `try/catch` в каждом действии и возвращают `500` с текстом исключения.
- Не знают, откуда ASP.NET Core берёт значения параметров действия.
- На `POST` возвращают 200 вместо 201 и не знают, что такое заголовок `Location`.

## EF Core на базовом уровне

```yaml
slug: ef-core-basics
questions: ef-core-chto-takoe-entity-framework-core, ef-core-kak-rabotaet-dbcontext, ef-core-chto-takoe-dbset-t, ef-core-chto-takoe-migrations, ef-core-chto-takoe-include, ef-core-chto-takoe-tracking-i-no-tracking-query, ef-core-chto-proishodit-pri-vyzove-tolist, ef-core-chem-ienumerable-otlichaetsya-ot-iqueryable-v-ef-core, ef-core-chto-takoe-projection-cherez-select, ef-core-chto-takoe-problema-n-1, ef-core-kak-posmotret-sql-kotoryi-generiruet-ef-core
articles: ef-changetracker, ienumerable-vs-iqueryable, zagruzka-svyazey-i-n-plus-1, ef-migracii
puzzles: ef-core-dbcontext-singleton, ef-core-ienumerable-vmesto-iqueryable, ef-core-n-plus-1-lazy-loading
```

**Что нужно знать**

- ORM: работа с таблицами как с объектами C#. Плюсы (скорость разработки, типобезопасность, миграции) и минусы (можно не заметить неэффективный SQL).
- `DbContext` и `DbSet<T>`: контекст — сессия работы с базой, `DbSet` — таблица. `DbContext` короткоживущий и не потокобезопасный, регистрируется через `AddDbContext` как `Scoped`.
- Модель: сущности, первичный ключ, навигационные свойства, связи один-ко-многим и многие-ко-многим. Настройка через атрибуты или Fluent API в `OnModelCreating`.
- Миграции: `dotnet ef migrations add`, `dotnet ef database update`; миграции — это код, который хранится в репозитории.
- CRUD: `Add`, `Find`, `Where(...).ToListAsync()`, изменение свойства и `SaveChangesAsync`, `Remove`. `SaveChanges` сохраняет все изменения одной транзакцией.
- Change tracking: контекст запоминает загруженные сущности и при `SaveChanges` сам формирует `UPDATE`. Для запросов только на чтение — `AsNoTracking()`.
- `IQueryable` против `IEnumerable`: пока запрос `IQueryable`, условия `Where` превращаются в SQL. После `ToList()` или `AsEnumerable()` дальнейшая фильтрация идёт в памяти по всем загруженным строкам.
- Загрузка связей: `Include` для подтягивания связанных данных. Проблема N+1 на уровне понимания: один запрос за списком и ещё по запросу на каждый элемент; как заметить в логах SQL.
- Проекция через `Select` в DTO: забирать только нужные колонки.
- Как посмотреть SQL: логирование EF Core в консоль, `ToQueryString()`.
- Асинхронные методы `ToListAsync`, `FirstOrDefaultAsync`, `SaveChangesAsync`.
- SQL-инъекция: почему `FromSqlRaw` со склеенной строкой опасен, а `FromSqlInterpolated` и параметры безопасны.

**На чём валятся**

- Регистрируют `DbContext` как `Singleton` или держат его в статическом поле.
- Вызывают `ToList()` в начале запроса и фильтруют всю таблицу в памяти.
- Не знают, что делает `SaveChanges` и когда реально уходит запрос в базу.
- Не видят N+1 в цикле, который обращается к навигационному свойству.
- Не умеют показать, какой SQL сгенерировал EF Core.

## SQL: запросы, индексы и транзакции

```yaml
slug: sql-basics
questions: postgresql-chto-takoe-where, postgresql-chem-inner-join-otlichaetsya-ot-left-join, postgresql-chto-takoe-group-by, postgresql-chem-where-otlichaetsya-ot-having, postgresql-chto-takoe-distinct, postgresql-kak-rabotaet-null, postgresql-chto-takoe-subquery, postgresql-kak-naiti-dublikaty, postgresql-chto-takoe-b-tree-index, postgresql-chto-takoe-composite-index, postgresql-chto-takoe-transaction, postgresql-kakie-urovni-izolyacii-tranzakcii-suschestvuyut
articles: sql-join-i-null, sql-gruppirovka-i-dublikaty, sql-podzaprosy-i-cte, indeksy-btree-gin-brin, pg-urovni-izolyacii
puzzles: postgresql-count-i-null, postgresql-paginaciya-bez-order-by, postgresql-not-in-s-null
```

**Что нужно знать**

- Реляционная модель: таблицы, строки, столбцы, первичный ключ, внешний ключ, ограничения `NOT NULL` и `UNIQUE`. Связь один-ко-многим через внешний ключ, многие-ко-многим через промежуточную таблицу.
- Основы: `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`/`OFFSET`, `DISTINCT`, `INSERT`, `UPDATE`, `DELETE`. Почему `UPDATE` и `DELETE` без `WHERE` опасны.
- `JOIN`: `INNER` возвращает только совпавшие строки, `LEFT` — все строки левой таблицы и `NULL` там, где пары нет. Типовая задача: «пользователи без заказов» через `LEFT JOIN ... WHERE o.id IS NULL`.
- Агрегаты: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`. `GROUP BY` и правило: в `SELECT` только поля группировки и агрегаты.
- `WHERE` фильтрует строки до группировки, `HAVING` — группы после неё.
- Логический порядок выполнения: `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`, `LIMIT`.
- `NULL`: сравнение через `IS NULL`, а не `= NULL`; `COUNT(*)` считает все строки, `COUNT(column)` пропускает `NULL`; `COALESCE` для значения по умолчанию.
- Подзапросы, `IN` и `EXISTS` на базовом уровне. Ловушка: `NOT IN` с подзапросом, где есть `NULL`, возвращает пустой результат.
- Поиск дубликатов через `GROUP BY ... HAVING COUNT(*) > 1`.
- Индекс: структура (обычно B-tree), которая ускоряет поиск, как оглавление в книге. Ускоряет `WHERE`, `JOIN`, `ORDER BY`, но замедляет `INSERT`/`UPDATE` и занимает место. Первичный ключ и `UNIQUE` создают индекс автоматически. Составной индекс работает по левому префиксу.
- Пагинация требует стабильного `ORDER BY`, иначе строки могут повторяться и пропадать между страницами.
- Транзакция и ACID: несколько операций выполняются целиком или не выполняются вовсе. `BEGIN`, `COMMIT`, `ROLLBACK`. Пример: перевод денег между счетами.
- Уровни изоляции на уровне названий и идеи; в PostgreSQL по умолчанию `Read Committed`.
- SQL-инъекции и параметризованные запросы.

**На чём валятся**

- Путают `INNER` и `LEFT JOIN` и теряют строки без пары.
- Пишут `WHERE column = NULL`.
- Используют `WHERE` с агрегатом вместо `HAVING`.
- Не могут объяснить, почему индекс не стоит создавать на каждую колонку.
- Не знают, что такое транзакция, или путают её с «одним запросом».

## Git, тесты и рабочие инструменты

```yaml
slug: git-tests-tools
questions:
articles:
puzzles:
```

Отдельных вопросов и статей по этой теме в каталоге пока нет, но на собеседовании Junior её почти всегда затрагивают, а в тестовом проверяют по истории коммитов и наличию тестов.

**Что нужно знать**

- Git: репозиторий, коммит, ветка, `HEAD`. Базовые команды: `clone`, `status`, `add`, `commit`, `push`, `pull`, `fetch`, `checkout`/`switch`, `branch`, `log`, `diff`.
- `fetch` против `pull`: первый только скачивает изменения, второй скачивает и сливает в текущую ветку.
- `merge` против `rebase` на уровне идеи: слияние с merge-коммитом против переноса своих коммитов поверх чужих. Почему не делают `rebase` и `push --force` в общую ветку.
- Конфликт слияния: откуда берётся и как разрешить вручную.
- Рабочий процесс в команде: ветка под задачу, pull request или merge request, code review, слияние в основную ветку.
- `.gitignore` для .NET: `bin/`, `obj/`, `.vs/`, файлы с секретами. Что делать, если пароль попал в коммит: сменить пароль, а не только удалить файл.
- Понятные сообщения коммитов: что и зачем изменено, а не «fix» и «update».
- Unit-тесты: зачем они нужны, структура Arrange–Act–Assert, фреймворки xUnit или NUnit, запуск через `dotnet test`. Что такое мок и зачем он нужен (Moq, NSubstitute), почему DI упрощает тестирование.
- Unit-тест и интеграционный тест: изолированная логика против проверки вместе с базой или HTTP-конвейером.
- Отладка: точки останова, пошаговое выполнение, просмотр переменных, стек вызовов. Умение найти ошибку отладчиком ценится выше, чем догадки.
- `dotnet` CLI: `new`, `build`, `run`, `test`, `add package`. NuGet-пакеты.
- Docker на уровне «запустить PostgreSQL одной командой для локальной разработки»; `docker compose` для тестового задания — приятный плюс.

**На чём валятся**

- Знают Git только через кнопки IDE и не могут объяснить, что произойдёт при `pull` с локальными изменениями.
- Присылают тестовое одним коммитом «initial» с папками `bin` и `obj`.
- Не написали ни одного теста и не могут объяснить, как протестировать сервис, зависящий от базы.
- Ищут ошибку через `Console.WriteLine` и не пользуются отладчиком.

## Алгоритмы и сложность

```yaml
slug: algorithms-basics
questions: algorithms-chto-takoe-big-o, algorithms-chto-takoe-o-1-o-log-n-o-n-o-n-log-n-o-n, algorithms-slozhnost-poiska-v-list, algorithms-slozhnost-poiska-v-dictionary, algorithms-chto-takoe-stack, algorithms-chto-takoe-queue, algorithms-kak-razvernut-stroku, algorithms-kak-proverit-yavlyaetsya-li-stroka-palindrome, algorithms-kak-naiti-dublikaty-v-massive, algorithms-kak-rabotaet-binary-search, algorithms-kak-naiti-dva-chisla-s-zadannoi-summoi, algorithms-kak-proverit-korrektnost-skobok
articles: algo-big-o, algo-klassy-slozhnosti, algo-stek-i-ochered, algo-binarnyy-poisk, drill-razminki-stroki-i-chisla, drill-two-sum, drill-skobochnaya-posledovatelnost
puzzles:
```

**Что нужно знать**

- Big O: как растёт время или память при росте входа. Отбрасываем константы и младшие слагаемые: O(2n + 5) это O(n).
- Основные классы: O(1), O(log n), O(n), O(n log n), O(n²). Пример для каждого: доступ по индексу, бинарный поиск, один проход по массиву, сортировка, два вложенных цикла.
- Сложность операций стандартных коллекций: поиск в `List` O(n), в `Dictionary` и `HashSet` в среднем O(1), сортировка `List.Sort` O(n log n).
- Память тоже считается: решение через `HashSet` быстрее, но требует O(n) дополнительной памяти.
- Стек и очередь: где применяются (проверка скобок, обход в ширину, отмена действий).
- Бинарный поиск: работает только на отсортированных данных, каждый шаг делит диапазон пополам, O(log n). Аккуратно с границами цикла.
- Сортировки на уровне идеи: пузырьковая O(n²) как пример неэффективной, quicksort и mergesort за O(n log n). Писать сортировку с нуля Junior обычно не просят, но могут спросить сложность `OrderBy`.
- Рекурсия: базовый случай, глубина, риск `StackOverflowException`.
- Типовые задачи Junior-уровня: развернуть строку или массив, палиндром, первый неповторяющийся символ, частоты слов, дубликаты в массиве, two sum, корректность скобок, FizzBuzz, максимум или второй максимум за один проход, слияние двух отсортированных массивов.
- Главный приём: заменить вложенный цикл поиска на `HashSet` или `Dictionary`, получив O(n) вместо O(n²).
- Порядок решения на собеседовании: переспросить условие, разобрать пример, проговорить простое решение, улучшить, написать код, прогнать на примере и на граничных случаях, назвать сложность.

**На чём валятся**

- Пишут код молча и не проверяют его на примере.
- Не учитывают граничные случаи: пустая строка, `null`, один элемент, отрицательные числа.
- Не могут назвать сложность своего решения или забывают, что `List.Contains` внутри цикла даёт O(n²).
- Используют LINQ там, где просят показать алгоритм вручную, и не могут объяснить, что происходит внутри.

## Самопрезентация и поведенческие вопросы

```yaml
slug: soft-skills-hiring
questions:
articles: etapy-nayma, chto-sprashivayut-na-screening, rasskaz-o-sebe, metod-star, voprosy-rabotodatelyu, podgotovka-po-greydam
puzzles:
```

**Что нужно знать**

- Как устроен найм: этапы, сроки, кто принимает решение и что смотрят на каждом шаге.
- Рассказ о себе на 1–2 минуты: кто вы, что изучали, какой проект сделали, что в нём было сложного и как вы это решили, почему хотите именно в эту компанию.
- Рассказ о проекте: задача, стек, архитектура в двух словах, ваша роль, что бы сделали иначе. Готовьтесь к вопросам по любой строке кода в репозитории.
- STAR для поведенческих вопросов: ситуация, задача, действие, результат. Без опыта работы примеры берите из учёбы, командных проектов, стажировок, прошлой профессии.
- Типичные вопросы к Junior: как учитесь, что изучили за последний месяц, как ищете решение, когда застряли, как относитесь к критике на code review, когда последний раз ошиблись и что сделали.
- Обучаемость показывают конкретикой: книга, курс, пет-проект, разобранная ошибка, а не «я быстро учусь».
- Вопросы к компании и ожидания по деньгам: узнайте вилку рынка заранее и называйте диапазон.

**На чём валятся**

- Рассказ о себе на десять минут с пересказом всей биографии.
- Не могут объяснить, что делали в проекте лично они.
- На вопрос про ошибку отвечают «я не ошибаюсь» или «слишком перфекционист».
- Не задают ни одного вопроса компании.
