---
title: Топологическая сортировка
slug: algo-topologicheskaya-sortirovka
track: algorithms
section: techniques
level: middle
sortOrder: 8
summary: Порядок выполнения в графе зависимостей — алгоритм Кана через входящие степени, DFS с тремя цветами и восстановлением цикла для сообщения об ошибке, параллельный запуск независимых задач и детерминированный порядок.
questions: algorithms-kak-opredelit-poryadok-vypolneniya-i-naiti-cikly-v-grafe-zavisimostei
---

Порядок сборки проектов, применения миграций и сидов, инициализации модулей, запуска шагов пайплайна — везде одна задача: есть элементы и зависимости между ними, нужно выстроить их так, чтобы каждая зависимость шла раньше зависимого. Это топологическая сортировка ориентированного графа. Такой порядок существует тогда и только тогда, когда в графе нет циклов, поэтому тот же алгоритм заодно отвечает на вопрос «где цикл».

Сам обход графа разобран в `DFS и BFS`; здесь — то, что отличает рабочий код от учебного: внятное сообщение об ошибке, одинаковый результат на любой машине и параллельный запуск.

## Граф зависимостей и DAG

Граф храним как словарь `deps`: `deps[v]` — от чего зависит `v`, то есть что должно выполниться раньше. Граф без ориентированных циклов называют DAG (directed acyclic graph); у него может быть много корректных порядков, у графа с циклом — ни одного.

В бэкенде это `ProjectReference` в MSBuild, миграции с зависимостями между модулями, DAG задач в оркестраторах вроде Airflow и шаги CI, пересчёт вычисляемых полей. И DI-контейнер: граф «сервис → зависимости конструктора»; `Microsoft.Extensions.DependencyInjection`, встретив в нём цикл при разрешении, бросает `InvalidOperationException` с текстом «A circular dependency was detected…» и цепочкой типов.

## Алгоритм Кана

Для каждой вершины считаем **входящую степень** — сколько у неё невыполненных зависимостей. Вершины с нулём готовы. Берём готовую, добавляем в результат и уменьшаем счётчик у всех, кто от неё зависит; обнулившиеся становятся готовыми. Если в конце в результат попали не все вершины, оставшиеся лежат на цикле или зависят от него.

```csharp
static (Dictionary<string, int> InDegree, Dictionary<string, List<string>> Dependents) Build(
    IReadOnlyDictionary<string, string[]> deps)
{
    var inDegree = new Dictionary<string, int>();
    var dependents = new Dictionary<string, List<string>>();
    foreach (var (node, ds) in deps)
    {
        inDegree[node] = ds.Length;
        foreach (var d in ds)
        {
            if (!deps.ContainsKey(d))
                throw new InvalidOperationException($"{node} зависит от неизвестного {d}");
            if (!dependents.TryGetValue(d, out var list)) dependents[d] = list = [];
            list.Add(node);
        }
    }
    return (inDegree, dependents);
}

static List<string> KahnOrder(IReadOnlyDictionary<string, string[]> deps)
{
    var (inDegree, dependents) = Build(deps);
    var ready = new PriorityQueue<string, string>(StringComparer.Ordinal);
    foreach (var (node, degree) in inDegree)
        if (degree == 0) ready.Enqueue(node, node);

    var order = new List<string>(inDegree.Count);
    while (ready.TryDequeue(out var node, out _))
    {
        order.Add(node);
        if (!dependents.TryGetValue(node, out var next)) continue;
        foreach (var d in next)
            if (--inDegree[d] == 0) ready.Enqueue(d, d);
    }

    if (order.Count < inDegree.Count)
    {
        var stuck = inDegree.Where(p => p.Value > 0).Select(p => p.Key).Order(StringComparer.Ordinal);
        throw new InvalidOperationException($"Цикл среди: {string.Join(", ", stuck)}");
    }
    return order;
}
```

Для графа `Api → {Orders, Auth}`, `Orders → {Db, Auth}`, `Auth → {Db}`, `Reports → {Db}` результат — `Db, Auth, Orders, Api, Reports`.

Ссылка на несуществующую вершину проверяется до запуска: это либо опечатка в конфигурации, либо внешняя готовая зависимость, и решить, что именно, должен код, а не случайность. Петля `A → A` обрабатывается без особого случая — у вершины степень 1, и она никогда не обнулится.

## Детерминированность

`PriorityQueue` вместо `Queue` здесь не ради скорости. С обычной очередью порядок среди одновременно готовых вершин зависит от порядка обхода словаря, то есть от истории вставок. Результат корректен, но после безобидного рефакторинга последовательность меняется, и миграция, которая молча полагалась на соседнюю, проходит локально и падает на CI. Сортировка готовых вершин с `StringComparer.Ordinal` (не зависит от культуры) делает порядок функцией только от графа. Цена — O(log V) на операцию вместо O(1).

## DFS с тремя цветами и сам цикл

У Кана слабое место — сообщение об ошибке. На графе `A → B → C → A`, `C → D`, `E → C` он вернёт «цикл среди A, B, C, E», хотя `E` в цикле не участвует, а просто от него зависит. Пользователю нужна цепочка, которую можно разорвать.

DFS даёт её даром. Белая вершина (0) не посещена, серая (1) лежит на текущем пути, чёрная (2) полностью обработана. Вершина попадает в результат на выходе, когда все её зависимости уже там, — это post-order, он и даёт порядок «зависимости раньше». Ребро в серую вершину — обратное ребро, то есть цикл, а путь от неё до текущей вершины и есть этот цикл. Двух цветов мало: в чёрную вершину можно прийти по другой ветке, и циклом это не является.

Рекурсивная версия есть в `DFS и BFS`. Для графов, пришедших извне, нужна итеративная: рекурсия глубиной V на длинной цепочке переполнит стек, а `StackOverflowException` в .NET не перехватывается — подробности в `Рекурсия и переполнение стека`. Явный стек хранит пары «вершина, индекс следующей зависимости», и в нём в каждый момент лежат ровно серые вершины — готовый путь для сообщения.

```csharp
static List<string> DfsOrder(IReadOnlyDictionary<string, string[]> deps)
{
    var color = new Dictionary<string, byte>(deps.Count);
    var order = new List<string>(deps.Count);
    var path = new Stack<(string Node, int Next)>();

    foreach (var root in deps.Keys.Order(StringComparer.Ordinal))
    {
        if (color.GetValueOrDefault(root) != 0) continue;
        color[root] = 1;
        path.Push((root, 0));
        while (path.Count > 0)
        {
            var (v, i) = path.Pop();
            var ds = deps[v];
            if (i == ds.Length)
            {
                color[v] = 2;
                order.Add(v);
                continue;
            }
            path.Push((v, i + 1));
            var d = ds[i];
            var c = color.GetValueOrDefault(d);
            if (c == 1) throw new InvalidOperationException("Цикл: " + DescribeCycle(path, d));
            if (c == 0)
            {
                color[d] = 1;
                path.Push((d, 0));
            }
        }
    }
    return order;
}

static string DescribeCycle(Stack<(string Node, int Next)> path, string start)
{
    var cycle = path.Select(p => p.Node).Reverse().SkipWhile(n => n != start).Append(start);
    return string.Join(" -> ", cycle);
}
```

`Stack<T>` перечисляется от вершины к основанию, поэтому `Reverse` даёт путь от корня; `SkipWhile` отрезает префикс до начала цикла. На том же графе сообщение — `A -> B -> C -> A`, на петле — `X -> X`. Корни перебираются в отсортированном порядке, поэтому и результат, и найденный цикл детерминированы. Эта версия проходит цепочку из миллиона вершин, на которой рекурсивная упала бы задолго до конца.

Если нужно показать **все** циклы сразу, ищут компоненты сильной связности (алгоритмы Тарьяна или Косарайю, тоже O(V + E)): каждая компонента больше одной вершины или вершина с петлёй — отдельный цикл. Сжатие компонент в точки снова даёт DAG — так поступают системы сборки, допускающие взаимные зависимости внутри модуля.

## Сложность

Оба алгоритма — O(V + E) по времени: каждая вершина обрабатывается один раз, каждое ребро просматривается один раз. Память — O(V + E) на обратный список `dependents` и счётчики у Кана, O(V) на цвета и стек у DFS. С `PriorityQueue` у Кана добавляется множитель log V на операции с готовыми вершинами: O(V log V + E).

| | Кан | DFS с цветами |
| --- | --- | --- |
| Сообщение о цикле | множество застрявших вершин | точная цепочка |
| Рекурсия | нет | нужна явная стековая версия |
| Параллельный запуск | естественный: готовые вершины независимы | неудобно |
| Добавление вершин по ходу | легко | сложнее |

На практике их комбинируют: Кан строит порядок и запускает задачи, а при ошибке DFS по застрявшим вершинам находит цепочку для сообщения.

## Параллельные уровни

Вершины, готовые одновременно, друг от друга не зависят, и их можно выполнять параллельно. Простейший вариант — **уровни**: тот же Кан, но очередь обрабатывается волнами; для примера выше это `[Db]`, `[Auth, Reports]`, `[Orders]`, `[Api]`. Число уровней равно длине самой длинной цепочки.

Выполнять уровень через `Task.WhenAll` просто, но медленно: уровень ждёт самую долгую задачу. Если `Reports` идёт 300 мс, а остальное по 50, `Orders` всё равно ждёт `Reports`, от которого не зависит. Правильнее планировать по событию завершения:

```csharp
static async Task RunAsync(IReadOnlyDictionary<string, string[]> deps,
    Func<string, CancellationToken, Task> run, int maxParallel, CancellationToken ct)
{
    var (inDegree, dependents) = Build(deps);
    var ready = new Queue<string>(inDegree.Where(p => p.Value == 0).Select(p => p.Key).Order(StringComparer.Ordinal));
    var running = new List<Task<string>>();
    int done = 0;

    while (ready.Count > 0 || running.Count > 0)
    {
        while (ready.Count > 0 && running.Count < maxParallel)
            running.Add(RunOne(ready.Dequeue()));

        var finished = await Task.WhenAny(running);
        running.Remove(finished);
        var node = await finished;
        done++;
        foreach (var d in dependents.GetValueOrDefault(node) ?? [])
            if (--inDegree[d] == 0) ready.Enqueue(d);
    }
    if (done < inDegree.Count) throw new InvalidOperationException("Цикл зависимостей");

    async Task<string> RunOne(string node)
    {
        await run(node, ct);
        return node;
    }
}
```

Счётчики меняет только координирующий цикл, поэтому `Interlocked` не нужен; при обработке завершений из разных потоков понадобился бы он или `Channel<T>`. `Task.WhenAny` по списку стоит O(maxParallel) на шаг — для десятков задач незаметно. Политику отказа решают отдельно: здесь `await finished` пробросит исключение, а запущенные задачи продолжат работать. В проде либо отменяют остальное через связанный `CancellationTokenSource`, либо помечают зависимые упавшей задачи как пропущенные и доделывают независимые ветки.

## Типичные ошибки

- **Обычная `Queue` и обход `Dictionary`** — порядок меняется между запусками.
- **Сообщение «есть цикл» без цепочки** — непонятно, какую зависимость убрать.
- **Обход из одной вершины** в несвязном графе или **перепутанное направление рёбер**.
- **Цикл в DI, спрятанный за `Lazy<T>` или `IServiceProvider`**: алгоритм доволен, а проблема дизайна доживает до рантайма. Лечится выносом общей части в третий сервис или событием.

## Что стоит ответить на собеседовании

Порядок выполнения в графе зависимостей — топологическая сортировка; она существует только для графа без циклов. Алгоритм Кана считает входящие степени и снимает с очереди вершины с нулём, обновляя счётчики зависимых; если в порядок попали не все вершины — есть цикл. DFS с тремя цветами кладёт вершину в результат на выходе, а ребро в серую вершину означает цикл. Оба работают за O(V + E).

Сильный ответ добавляет инженерные детали: DFS выдаёт конкретную цепочку цикла для сообщения, а Кан — только множество застрявших вершин; порядок делают детерминированным через `PriorityQueue` или сортировку готовых вершин; на больших графах DFS пишут итеративно; независимые задачи запускают параллельно по событию завершения, а не уровнями через `Task.WhenAll`, с ограничением параллелизма и явной политикой отказа. Хорошо упомянуть, что MS.DI обнаруживает циклы при разрешении сервиса, а для всех циклов сразу нужны компоненты сильной связности.
