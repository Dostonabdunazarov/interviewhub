---
title: Reflection, expression trees и source generators
slug: cs-reflection-i-source-generators
track: dotnet-backend
section: csharp-lang
level: senior
sortOrder: 15
summary: Из чего складывается цена reflection, как превратить динамический вызов в обычный через делегаты, expression trees и UnsafeAccessor, и почему source generators переносят эту работу на этап компиляции.
questions: advanced-csharp-pochemu-reflection-dorog-i-kakie-sposoby-ego-uskorit-suschestvuyut, advanced-csharp-kogda-expression-trees-predpochtitelnee-skompilirovannyh-delegatov-i-n, advanced-csharp-kak-source-generators-reshayut-problemy-reflection-i-kakie-ogranicheni
---

Сериализаторы, ORM, DI-контейнеры и мапперы решают одну задачу: работать с типами, которых автор библиотеки не видел. Исторически для этого есть reflection — универсальный, но медленный и плохо совместимый с trimming. Всё, что появилось позже, — кэшированные делегаты, скомпилированные деревья выражений, `UnsafeAccessor`, source generators — по сути способы превратить динамический вызов в обычный, либо в рантайме, либо ещё при сборке.

Тема на senior-уровне проверяет не знание API, а понимание, где именно платится цена и на каком этапе её можно убрать.

## Из чего складывается цена reflection

У reflection две разные стоимости, и их полезно разделять.

**Поиск.** `GetMethod("Add")`, `GetProperties()`, `GetCustomAttributes()` идут по метаданным, сравнивают строки, фильтруют по `BindingFlags`. У рантайма есть внутренний кэш `MethodInfo`, но вызов всё равно не бесплатный, а `GetProperties()` возвращает новый массив на каждый вызов. `GetCustomAttributes()` каждый раз создаёт новые экземпляры атрибутов — это самая дорогая операция из списка.

**Вызов.** `MethodInfo.Invoke(obj, object[])` проходит универсальный путь: аргументы упакованы в массив, каждый value type забоксен, рантайм проверяет число и типы параметров, результат возвращается как `object`, исключения оборачиваются в `TargetInvocationException`. Для JIT такой вызов непрозрачен — ни инлайнинга, ни девиртуализации.

Замер на .NET 10 (Release, Stopwatch и `GC.GetAllocatedBytesForCurrentThread`, цифры порядковые, для точных нужен BenchmarkDotNet — см. `Как мерить: BenchmarkDotNet`), метод `int Add(int, int)`:

```
MethodInfo.Invoke(obj, new object[]{2, 3})   ~75 нс   112 байт
MethodInvoker.Invoke(obj, 2, 3)              ~43 нс    72 байта
делегат из CreateDelegate                    ~единицы нс, 0 байт
GetMethod("Add") без кэша                    ~49 нс
GetCustomAttributes(false)                   472 байта на вызов
```

112 байт — это массив на два элемента, два упакованных `int` и упакованный результат. `MethodInvoker` (.NET 8) убирает массив, но не боксинг. Стоит помнить и про прогресс самого рантайма: с .NET 7 `Invoke` после нескольких вызовов переключается на сгенерированный IL-стаб, поэтому старые цифры «reflection в сто раз медленнее» уже неточны. Порядок при этом сохраняется: прямой вызов и типизированный делегат — единицы наносекунд, `Invoke` — десятки, поиск без кэша в горячем пути — ещё сверху.

## Как ускорить: от кэша до UnsafeAccessor

**Кэшировать метаданные.** Главное правило — не искать члены в горячем пути. Для статически известного `T` удобен generic static-класс: JIT создаёт отдельную копию на каждый тип, и поиска по словарю нет вовсе.

```csharp
static class PropsCache<T>
{
    public static readonly PropertyInfo[] Props = typeof(T).GetProperties();
}
```

Для типов, известных только в рантайме, — `ConcurrentDictionary<Type, ...>`.

**Типизированный делегат.** `CreateDelegate` один раз связывает `MethodInfo` с делегатом, дальше вызов стоит как обычный вызов делегата, без массива, боксинга и проверок:

```csharp
var getName = typeof(User).GetProperty(nameof(User.Name))!
    .GetMethod!.CreateDelegate<Func<User, string>>();
string name = getName(user);
```

Ограничение — сигнатуру делегата надо знать при компиляции. Если `User` неизвестен, на помощь приходят деревья выражений или `DynamicMethod` с ручной генерацией IL (так исторически работал Dapper). IL-генерация даёт максимум гибкости, но её тяжело писать и отлаживать.

**`[UnsafeAccessor]` (.NET 8).** Доступ к приватным полям, методам и конструкторам без reflection вообще: объявляется `extern`-метод, а JIT подставляет прямой доступ.

```csharp
[UnsafeAccessor(UnsafeAccessorKind.Field, Name = "_items")]
static extern ref int[] Items(MyList list);
```

Имя члена проверяется при первом вызове, а не при компиляции, но в рантайме это обычный вызов, совместимый с Native AOT. Это правильный инструмент для тестов и сериализаторов, которым нужны приватные члены.

## Expression trees: код как данные

Делегат — исполняемый код, его можно только вызвать. `Expression<Func<...>>` — дерево объектов, описывающее этот код: его можно обойти, преобразовать, перевести на другой язык или скомпилировать.

```csharp
Func<User, bool>             f = u => u.Age > 18;
Expression<Func<User, bool>> e = u => u.Age > 18;

users.Where(f);
db.Users.Where(e);
```

Первая строка вызова фильтрует в памяти. Во второй EF Core обходит дерево и строит `WHERE "Age" > 18` — подробно в `IEnumerable vs IQueryable` и `Трансляция IQueryable в SQL`. Из IL такое намерение надёжно не восстановить, поэтому для трансляции нужны именно данные.

Деревья выбирают в трёх случаях: **анализ кода** (LINQ-провайдеры, `HasKey(x => x.Id)`, `RuleFor(x => x.Name)`), **динамическое построение** (фильтры из UI, комбинирование предикатов через `Expression.AndAlso` с заменой параметра в `ExpressionVisitor`) и **генерация аксессоров** для неизвестных типов — например, `(object o) => (object)((T)o).Prop`, скомпилированное один раз.

Ловушка из той же области: метод, принимающий `Func<T, bool>` вместо `Expression<Func<T, bool>>`, превращает `db.Users.Where(predicate)` в `Enumerable.Where` — вся таблица уезжает в память, компилятор молчит.

## Цена Compile и интерпретатор

`Expression.Compile()` строит `DynamicMethod` и прогоняет его через JIT. В том же замере первый `Compile` в процессе занял около 10 мс (вместе с прогревом инфраструктуры), повторные — от сотен микросекунд. Готовый делегат вызывается за единицы наносекунд и не аллоцирует. Вывод: компиляция дороже вызова на пять порядков, и её **обязательно кэшируют**.

```csharp
static readonly ConcurrentDictionary<Type, Func<object, object?>> Getters = new();

public static object? Get(object o) =>
    Getters.GetOrAdd(o.GetType(), t => BuildGetter(t).Compile())(o);
```

Классическая ошибка — `BuildGetter(t).Compile()(o)` без кэша на каждый запрос.

`Compile(preferInterpretation: true)` выбирает интерпретатор: построение дешевле, но вызов в замере стал ~115 нс и 152 байта — медленнее даже `Invoke`. Он оправдан для выражений, которые выполнятся несколько раз. В Native AOT JIT нет, и `Compile()` там всегда уходит в интерпретатор, — ещё один повод для AOT-кода выбирать генераторы.

Обычный делегат лучше дерева, когда код известен при компиляции, когда выражение нужно выполнить однократно и когда лямбда содержит то, что компилятор C# в дерево не превращает: блоки операторов, присваивание, `?.`, `async`.

## Source generators: работа переносится в сборку

Source generator — плагин Roslyn, который во время компиляции читает синтаксис и семантическую модель проекта и добавляет новые C#-файлы. Всё, что reflection выяснял в рантайме, генератор выясняет при сборке и выписывает обычный код.

```csharp
[JsonSerializable(typeof(Order))]
internal partial class AppJsonContext : JsonSerializerContext { }

var json = JsonSerializer.Serialize(order, AppJsonContext.Default.Order);
```

Для `Order` генерируются метаданные и код записи свойств напрямую. В рантайме нет поиска членов, `Invoke` и `Reflection.Emit`, нет прогрева при первом вызове. В самом .NET так же устроены `[GeneratedRegex]` (регулярка становится C#-кодом), `[LoggerMessage]` (логирование без боксинга аргументов и разбора шаблона), `[LibraryImport]` для P/Invoke, биндер конфигурации и Request Delegate Generator для minimal API; из сторонних — Mapperly, Refit.

Современный API — `IIncrementalGenerator`. Генератор описывает конвейер (`ForAttributeWithMetadataName` → модель → `RegisterSourceOutput`), Roslyn кэширует промежуточные шаги и пересчитывает только изменившееся. Старый `ISourceGenerator` выполнялся на каждое изменение в редакторе и тормозил IDE. Кэширование работает, только если модели в конвейере сравниваются по значению: хранить в них `ISymbol` или `SyntaxNode` — типичная ошибка.

**Ограничения:**

- генератор **только добавляет** код. Изменить существующий метод нельзя, поэтому пользовательский тип объявляется `partial`, а генератор дописывает вторую половину. Подменять вызовы умеют только interceptors — отдельная, более узкая фича;
- он видит **только то, что известно при компиляции**: плагины, загружаемые в рантайме, полиморфизм через `object`, данные из БД ему недоступны. В STJ наследников объявляют явно через `[JsonDerivedType]`, а generic-инстанциации перечисляют в `[JsonSerializable]`;
- генераторы не видят вывод друг друга — цепочки невозможны;
- сборка генератора таргетирует `netstandard2.0` и подключается как анализатор, отладка — через тесты на `CSharpGeneratorDriver` или `Debugger.Launch()`; сгенерированное можно выгрузить на диск свойством `EmitCompilerGeneratedFiles`.

## Trimming и Native AOT

Reflection по строке несовместим с trimming: линкер не видит, что `GetMethod("Foo")` использует `Foo`, и может его вырезать. Частично спасают аннотации `[DynamicallyAccessedMembers]`, но `Reflection.Emit` в AOT недоступен совсем, а деревья выражений только интерпретируются. Сгенерированный код — обычные ссылки на члены, линкер видит их как есть. Поэтому для AOT-сценариев (serverless, быстрый старт контейнера) генераторы — не оптимизация, а условие работоспособности. Выигрыш по пропускной способности при этом может быть скромным: reflection с хорошим кэшем делегатов на горячем пути тоже быстр, главная выгода генераторов — старт, AOT и ошибки при сборке.

## Что стоит ответить на собеседовании

Reflection дорог дважды: поиск членов по метаданным и строкам и универсальный `Invoke` с массивом `object[]`, боксингом value types, проверками типов и без оптимизаций JIT. Ускоряют его, убирая динамику: кэшируют `MethodInfo`/`PropertyInfo`, один раз создают типизированный делегат через `CreateDelegate` или компилируют expression tree, для приватных членов используют `UnsafeAccessor`. Expression tree — это код как данные: его выбирают, когда код надо анализировать или транслировать (`IQueryable` в SQL) либо собрать в рантайме для неизвестного типа, а `Compile()` дорогой и кэшируется.

Сильный ответ разделяет цену поиска и цену вызова, знает, что `Invoke` с .NET 7 заметно ускорился, а `MethodInvoker` убирает массив, но не боксинг, и что в Native AOT `Compile()` уходит в медленный интерпретатор. Про source generators он скажет, что это перенос reflection в compile time через `IIncrementalGenerator`, назовёт STJ source gen, `LoggerMessage` и `GeneratedRegex` и перечислит ограничения: только добавление кода через `partial`, только compile-time знание о типах, нет цепочек генераторов. И заметит, что главный выигрыш генераторов — старт, совместимость с trimming и AOT, а не скорость отдельного вызова.
