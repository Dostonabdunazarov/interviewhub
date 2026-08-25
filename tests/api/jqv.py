import os, sys, json
# Выражение вида "['id']" применяется к d; начинающееся с "!" — вычисляется как есть,
# чтобы можно было писать any(...)/len(...) без обёртки в список.
try:
    d = json.loads(os.environ.get("JSON_IN", ""))
    expr = sys.argv[1]
    print(eval(expr[1:] if expr.startswith("!") else "d" + expr))
except Exception:
    print("")
