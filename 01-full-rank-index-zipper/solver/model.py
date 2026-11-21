from ortools.sat.python import cp_model

def readings():
    R = []
    for k in range(1, 10): R.append((f"T{k}", [(r, k) for r in range(1, 10)]))
    for k in range(1, 10): R.append((f"R{k}", [(k, c) for c in range(9, 0, -1)]))
    for k in range(1, 10):
        col = 10 - k; R.append((f"B{col}", [(r, col) for r in range(9, 0, -1)]))
    for k in range(1, 10):
        row = 10 - k; R.append((f"L{row}", [(row, c) for c in range(1, 10)]))
    return R

INNER = [(4,3),(4,2),(5,3),(5,4),(5,5),(4,5),(3,5),(4,4),(3,3)]
LAB = [l for l,_ in readings()]
POS = {l:i+1 for i,l in enumerate(LAB)}

def build(extra=None, skip=()):
    m = cp_model.CpModel()
    g = {(r,c): m.NewIntVar(1, 9, f"g{r}{c}") for r in range(1,10) for c in range(1,10)}
    for i in range(1,10):
        m.AddAllDifferent([g[i,c] for c in range(1,10)])
        m.AddAllDifferent([g[r,i] for r in range(1,10)])
    RD = readings()
    N = []
    for lab, cells in RD:
        n = m.NewIntVar(111111111, 999999999, "N"+lab)
        m.Add(n == sum(g[cell] * 10**(8-i) for i, cell in enumerate(cells)))
        N.append(n)
    rank = [m.NewIntVar(1, 36, "rk"+lab) for lab, _ in RD]
    m.AddAllDifferent(rank)
    lt = {}
    for p in range(36):
        for q in range(p+1, 36):
            b = m.NewBoolVar(f"lt{p}_{q}")
            m.Add(N[q] < N[p]).OnlyEnforceIf(b)
            m.Add(N[q] > N[p]).OnlyEnforceIf(b.Not())
            lt[p,q] = b; lt[q,p] = b.Not()
    for p in range(36):
        m.Add(rank[p] == 1 + sum(lt[p,q] for q in range(36) if q != p))
    if 'outer' not in skip:
        X = [[m.NewBoolVar(f"x{p}_{v}") for v in range(36)] for p in range(36)]
        for p in range(36):
            m.AddExactlyOne(X[p]); m.Add(rank[p] == sum((v+1)*X[p][v] for v in range(36)))
        for p in range(36):
            for v in range(p+1, 36): m.Add(X[p][v] == X[v][p])
    if 'inner' not in skip:
        Y = [[m.NewBoolVar(f"y{i}_{v}") for v in range(9)] for i in range(9)]
        for i, cell in enumerate(INNER):
            m.AddExactlyOne(Y[i]); m.Add(g[cell] == sum((v+1)*Y[i][v] for v in range(9)))
        for i in range(9):
            for v in range(i+1, 9): m.Add(Y[i][v] == Y[v][i])
    ext = {lab: rank[i] for i, (lab, _) in enumerate(RD)}
    if 'z1' not in skip:
        for a, b in [(1,9),(2,8),(3,7),(4,6)]: m.Add(g[1,a] + g[1,b] == g[1,5])
    if 'z2' not in skip:
        m.Add(g[3,8] + g[3,9] == g[4,9]); m.Add(g[2,7] + ext["R2"] == g[4,9])
    if 'z3' not in skip:
        m.Add(g[3,1] + ext["L5"] == g[4,1])
    if 'z4' not in skip:
        s = g[9,4]
        m.Add(g[9,3] + g[9,5] == s); m.Add(g[8,3] + g[8,6] == s); m.Add(g[7,2] + g[8,7] == s); m.Add(g[6,2] + g[8,8] == s)
    if 'z5' not in skip:
        m.Add(g[6,5] + g[7,6] == g[7,5])
    if 'z6' not in skip:
        m.Add(g[8,1] + g[8,2] == ext["L8"]); m.Add(g[7,1] + g[9,1] == ext["L8"])
    if 'z7' not in skip:
        m.Add(g[9,7] + g[9,9] == g[9,8])
    if extra: extra(m, g, ext)
    return m, g, rank, RD, ext

def count(skip=(), extra=None, cap=3, t=300):
    m, g, rank, RD, ext = build(extra=extra, skip=skip)
    s = cp_model.CpSolver(); s.parameters.num_workers = 4; s.parameters.max_time_in_seconds = t
    n = 0; sols = []; st=None
    while n < cap:
        st = s.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): break
        n += 1
        grid = {k: s.Value(v) for k, v in g.items()}; sols.append(grid)
        bs = []
        for k, v in g.items():
            b = m.NewBoolVar(""); m.Add(v != grid[k]).OnlyEnforceIf(b); m.Add(v == grid[k]).OnlyEnforceIf(b.Not()); bs.append(b)
        m.AddBoolOr(bs)
    return n, (s.StatusName(st) if st is not None else None), sols

def show(grid):
    return "\n".join("".join(str(grid[r,c]) for c in range(1,10)) for r in range(1,10))
