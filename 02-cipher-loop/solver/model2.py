from ortools.sat.python import cp_model
N = 12
COLS = {1:['?','H','?E','?E'], 2:['H','J?'], 3:['?B','C'], 4:['?','C','C','?','?'], 5:['JH','?','?G'], 6:['D','?','?'],
        7:['A?'], 8:['D','?','?','?'], 9:['C','C','C','C'], 10:['A','?','I','?'], 11:['?','F','?','F?','?'], 12:['JA','?','?I']}
ROWS = {1:['??','?I','JC'], 3:['??','?','H','D'], 6:['?'], 8:['??','??','??'], 10:['?B','?','F'], 12:['I','?','?','?']}
LET = 'ABCDEFGHIJ'

def build(extra=None, skip=()):
    m = cp_model.CpModel()
    R = range(1, N+1)
    inn = {(r,c): m.NewBoolVar(f"in{r}_{c}") for r in R for c in R}
    x = {(r,c,d): m.NewBoolVar(f"x{r}_{c}_{d}") for r in R for c in R for d in range(1,10)}
    v = {}
    for r in R:
        for c in R:
            m.Add(sum(x[r,c,d] for d in range(1,10)) == inn[r,c])
            v[r,c] = m.NewIntVar(0, 9, f"v{r}_{c}")
            m.Add(v[r,c] == sum(d*x[r,c,d] for d in range(1,10)))
    for i in R:
        for d in range(1,10):
            m.Add(sum(x[i,c,d] for c in R) <= 1)
            m.Add(sum(x[r,i,d] for r in R) <= 1)
    def isin(r,c): return inn[r,c] if (1<=r<=N and 1<=c<=N) else None
    # boundary edges: XOR with neighbor (outside grid = out)
    bnd = {}
    for r in R:
        for c in R:
            for dr,dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                nb = (r+dr, c+dc)
                if 1<=nb[0]<=N and 1<=nb[1]<=N:
                    key = tuple(sorted([(r,c), nb]))
                    if key not in bnd:
                        b = m.NewBoolVar("")
                        m.AddBoolXOr([inn[key[0]], inn[key[1]], b.Not()])
                        bnd[key] = b
                else:
                    key = ((r,c), nb)
                    bnd[key] = inn[r,c]
    def edges(r,c):
        out = []
        for dr,dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nb = (r+dr,c+dc)
            if 1<=nb[0]<=N and 1<=nb[1]<=N: out.append(bnd[tuple(sorted([(r,c),nb]))])
            else: out.append(bnd[((r,c),nb)])
        return out
    if 'clue123' not in skip:
        for r in R:
            for c in R:
                for d in (1,2,3):
                    m.Add(sum(edges(r,c)) == d).OnlyEnforceIf(x[r,c,d])
    # no diagonal touching
    for r in range(1,N):
        for c in range(1,N):
            a,b,cc,dd = inn[r,c], inn[r,c+1], inn[r+1,c], inn[r+1,c+1]
            # forbid a=dd=1,b=cc=0 and a=dd=0,b=cc=1
            m.AddBoolOr([a.Not(), dd.Not(), b, cc])
            m.AddBoolOr([a, dd, b.Not(), cc.Not()])
    # inside connectivity (flow)
    cells = [(r,c) for r in R for c in R]
    BIG = N*N
    adj = [(p,q) for p in cells for q in [(p[0]+1,p[1]),(p[0],p[1]+1)] if q[0]<=N and q[1]<=N]
    root = {p: m.NewBoolVar("") for p in cells}
    m.AddExactlyOne(root.values())
    for p in cells: m.AddImplication(root[p], inn[p])
    f = {}
    for p,q in adj:
        for a,b in [(p,q),(q,p)]:
            f[a,b] = m.NewIntVar(0, BIG, "")
            m.Add(f[a,b] == 0).OnlyEnforceIf(inn[a].Not()); m.Add(f[a,b] == 0).OnlyEnforceIf(inn[b].Not())
    sup = {p: m.NewIntVar(0, BIG, "") for p in cells}
    for p in cells:
        m.Add(sup[p] == 0).OnlyEnforceIf(root[p].Not())
        inflow = sum(f[a,b] for (a,b) in f if b == p); outflow = sum(f[a,b] for (a,b) in f if a == p)
        m.Add(sup[p] + inflow - outflow == inn[p])
    # outside connectivity: exterior node 'E'
    g = {}
    for p,q in adj:
        for a,b in [(p,q),(q,p)]:
            g[a,b] = m.NewIntVar(0, BIG, "")
            m.Add(g[a,b] == 0).OnlyEnforceIf(inn[a]); m.Add(g[a,b] == 0).OnlyEnforceIf(inn[b])
    ext = {}
    for p in cells:
        if p[0] in (1,N) or p[1] in (1,N):
            ext[p] = m.NewIntVar(0, BIG, ""); m.Add(ext[p] == 0).OnlyEnforceIf(inn[p])
    for p in cells:
        inflow = sum(g[a,b] for (a,b) in g if b == p) + (ext[p] if p in ext else 0)
        outflow = sum(g[a,b] for (a,b) in g if a == p)
        m.Add(inflow - outflow == 1).OnlyEnforceIf(inn[p].Not())
        m.Add(inflow - outflow == 0).OnlyEnforceIf(inn[p])
    # letters
    L = {ch: m.NewIntVar(0, 9, "L"+ch) for ch in LET}
    m.AddAllDifferent(list(L.values()))
    def clue_value(s):
        terms = []; digs = []
        for i, ch in enumerate(s):
            if ch == '?': dv = m.NewIntVar(0, 9, "")
            else: dv = L[ch]
            digs.append(dv)
        if len(digs) > 1: m.Add(digs[0] >= 1)
        else: m.Add(digs[0] >= 1)
        return sum(dv * 10**(len(digs)-1-i) for i, dv in enumerate(digs)), digs
    clue_digits = {}
    def line_clue(cells_line, clues, tag):
        k = len(clues)
        n = len(cells_line)
        ins = [inn[p] for p in cells_line]
        start = []
        for i in range(n):
            s = m.NewBoolVar("")
            if i == 0: m.Add(s == ins[0])
            else:
                m.AddBoolAnd([ins[i], ins[i-1].Not()]).OnlyEnforceIf(s)
                m.AddBoolOr([ins[i].Not(), ins[i-1], s])
            start.append(s)
        m.Add(sum(start) == k)
        cnt = [m.NewIntVar(0, k, "") for i in range(n)]
        for i in range(n):
            m.Add(cnt[i] == sum(start[:i+1]))
        for gi in range(1, k+1):
            val, digs = clue_value(clues[gi-1]); clue_digits[(tag, gi)] = digs
            contrib = []
            for i in range(n):
                bgi = m.NewBoolVar("")
                # bgi = ins[i] and cnt[i]==gi
                eq = m.NewBoolVar(""); m.Add(cnt[i] == gi).OnlyEnforceIf(eq); m.Add(cnt[i] != gi).OnlyEnforceIf(eq.Not())
                m.AddBoolAnd([ins[i], eq]).OnlyEnforceIf(bgi); m.AddBoolOr([ins[i].Not(), eq.Not(), bgi])
                w = m.NewIntVar(0, 9, ""); m.Add(w == v[cells_line[i]]).OnlyEnforceIf(bgi); m.Add(w == 0).OnlyEnforceIf(bgi.Not())
                contrib.append(w)
            m.Add(sum(contrib) == val)
    if 'clues' not in skip:
        for c, cl in COLS.items(): line_clue([(r,c) for r in R], cl, f"C{c}")
        for r, cl in ROWS.items(): line_clue([(r,c) for c in R], cl, f"R{r}")
    if extra: extra(m, inn, v, L)
    return m, inn, v, L, clue_digits

def solve_all(cap=3, extra=None, t=600):
    m, inn, v, L, cd = build(extra)
    s = cp_model.CpSolver(); s.parameters.num_workers = 8; s.parameters.max_time_in_seconds = t
    sols = []
    while len(sols) < cap:
        st = s.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): print("status", s.StatusName(st), s.WallTime()); break
        grid = {k: s.Value(val) for k, val in v.items()}
        lets = {k: s.Value(val) for k, val in L.items()}
        sols.append((grid, lets))
        print("--- solution", len(sols), "time", round(s.WallTime(),1))
        for r in range(1, N+1): print(" ".join(str(grid[r,c]) if grid[r,c] else '.' for c in range(1, N+1)))
        print(lets)
        bs = []
        for k, val in v.items():
            b = m.NewBoolVar(""); m.Add(val != grid[k]).OnlyEnforceIf(b); m.Add(val == grid[k]).OnlyEnforceIf(b.Not()); bs.append(b)
        m.AddBoolOr(bs)
    return sols

if __name__ == "__main__":
    solve_all()
