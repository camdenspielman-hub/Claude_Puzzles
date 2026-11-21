"""Human-style propagation engine for the loop/sum/cipher puzzle. Logs each deduction with the unit that made it."""
import itertools, json, sys, copy
from ortools.sat.python import cp_model
from model2 import COLS, ROWS, N, LET
R = range(1, N+1)
SOL_TXT = """8 5 . 9 6 . 2 1 7 4 3 .
. 2 . . 1 9 4 8 . . . .
5 1 6 . 7 . 8 . . 3 2 4
3 . 5 1 4 . 6 . . . . 2
. . 9 6 . . 7 . 2 5 4 8
. . . . . . 1 2 5 . . .
4 . 2 7 8 6 9 . . . 5 .
9 8 1 . . . 5 4 6 . 7 3
. 7 4 8 2 . . 5 1 6 9 .
6 4 . . 5 . . . . 2 . .
7 . . 2 9 5 . 3 4 1 8 6
. . . 5 . 4 . . 3 . . 9"""
SOL = {(r+1,c+1): (0 if t=='.' else int(t)) for r,l in enumerate(SOL_TXT.split('\n')) for c,t in enumerate(l.split())}
SOLL = {'A': 4, 'B': 0, 'C': 7, 'D': 9, 'E': 3, 'F': 2, 'G': 6, 'H': 8, 'I': 5, 'J': 1}

class Contradiction(Exception): pass

class State:
    def __init__(self):
        self.cand = {(r,c): set(range(10)) for r in R for c in R}
        self.lc = {ch: set(range(10)) for ch in LET}
        self.log = []
    def copy(self):
        s = State.__new__(State); s.cand = {k: set(v) for k,v in self.cand.items()}; s.lc = {k:set(v) for k,v in self.lc.items()}; s.log = []
        return s
    def isin(self, p):  # True/False/None
        if not (1<=p[0]<=N and 1<=p[1]<=N): return False
        c = self.cand[p]
        if 0 not in c: return True
        if c == {0}: return False
        return None
    def restrict(self, p, allowed, why):
        old = self.cand[p]; new = old & set(allowed)
        if not new: raise Contradiction(f"{p} empty via {why}")
        if new != old:
            self.cand[p] = new
            self.log.append(('cell', p, sorted(old-new), why))
            return True
        return False
    def lrestrict(self, ch, allowed, why):
        old = self.lc[ch]; new = old & set(allowed)
        if not new: raise Contradiction(f"letter {ch} empty via {why}")
        if new != old:
            self.lc[ch] = new; self.log.append(('let', ch, sorted(old-new), why)); return True
        return False
    def check_sol(self):
        for p, v in SOL.items():
            if v not in self.cand[p]: return f"cell {p} lost true value {v}"
        for ch, v in SOLL.items():
            if v not in self.lc[ch]: return f"letter {ch} lost {v}"
        return None

def line_cells(tag):
    k = int(tag[1:])
    return [(r,k) for r in R] if tag[0]=='C' else [(k,c) for c in R]
LINES = [(f"C{c}", cl) for c, cl in COLS.items()] + [(f"R{r}", cl) for r, cl in ROWS.items()]

# ---------- unit: letters (bijection)
def unit_letters(S):
    ch = False
    for a in LET:
        if len(S.lc[a]) == 1:
            d = next(iter(S.lc[a]))
            for b in LET:
                if b != a: ch |= S.lrestrict(b, set(range(10))-{d}, f"letter {a}={d}")
    for d in range(10):
        hold = [a for a in LET if d in S.lc[a]]
        if len(hold) == 1 and len(S.lc[hold[0]]) > 1: ch |= S.lrestrict(hold[0], {d}, f"only {hold[0]} can be {d}")
        if not hold: raise Contradiction(f"digit {d} unused")
    return ch

# ---------- unit: Latin (naked singles)
def unit_latin(S):
    ch = False
    for p in S.cand:
        c = S.cand[p]
        if len(c) == 1 and next(iter(c)) > 0:
            d = next(iter(c))
            for q in S.cand:
                if q != p and (q[0]==p[0] or q[1]==p[1]) and d in S.cand[q]:
                    ch |= S.restrict(q, S.cand[q]-{d}, f"latin {p}={d}")
    return ch

# ---------- unit: 1/2/3 cell rule (cell + 4 neighbours)
NB = [(-1,0),(1,0),(0,-1),(0,1)]
def unit_123(S):
    ch = False
    for p in S.cand:
        cs = S.cand[p]
        nbs = [(p[0]+dr, p[1]+dc) for dr,dc in NB]
        opts = []
        for q in nbs:
            st = S.isin(q)
            opts.append([st] if st is not None else [True, False])
        okv = set(); okn = [set() for _ in nbs]
        for v in cs:
            for combo in itertools.product(*opts):
                if v in (1,2,3) and sum(1 for x in combo if not x) != v: continue
                okv.add(v)
                for i,x in enumerate(combo): okn[i].add(x)
        if not okv: raise Contradiction(f"123 at {p}")
        ch |= S.restrict(p, okv, f"123rule {p}")
        if len(S.cand[p]) and S.cand[p] <= {1,2,3}:
            pass
        for i,q in enumerate(nbs):
            if 1<=q[0]<=N and 1<=q[1]<=N and len(okn[i]) == 1:
                if okn[i] == {True}: ch |= S.restrict(q, S.cand[q]-{0}, f"123rule {p} needs nb in")
                else: ch |= S.restrict(q, {0}, f"123rule {p} needs nb out")
    return ch

# ---------- unit: 2x2 no-touch
def unit_2x2(S):
    ch = False
    for r in range(1,N):
        for c in range(1,N):
            ps = [(r,c),(r,c+1),(r+1,c),(r+1,c+1)]
            opts = [[S.isin(p)] if S.isin(p) is not None else [True,False] for p in ps]
            ok = [set() for _ in ps]
            for a,b,cc,d in itertools.product(*opts):
                if (a and d and not b and not cc) or (b and cc and not a and not d): continue
                for i,x in enumerate((a,b,cc,d)): ok[i].add(x)
            for i,p in enumerate(ps):
                if len(ok[i]) == 0: raise Contradiction("2x2")
                if len(ok[i]) == 1 and S.isin(p) is None:
                    ch |= S.restrict(p, S.cand[p]-{0} if ok[i]=={True} else {0}, f"2x2 no-touch at r{r}c{c}")
    return ch

# ---------- unit: topology
def comps(cells_set, extra_ext=False):
    pass
def reach(start, allowed, ext_ok=False):
    seen = set(start); st = list(start)
    while st:
        p = st.pop()
        if p == 'EXT':
            nbs = [q for q in allowed if q != 'EXT' and (q[0] in (1,N) or q[1] in (1,N))]
        else:
            nbs = [(p[0]+dr,p[1]+dc) for dr,dc in NB]
            if ext_ok and (p[0] in (1,N) or p[1] in (1,N)): nbs.append('EXT')
        for q in nbs:
            if q in allowed and q not in seen: seen.add(q); st.append(q)
    return seen
def unit_topo(S):
    ch = False
    ins = [p for p in S.cand if S.isin(p) is True]
    unk = [p for p in S.cand if S.isin(p) is None]
    outs = [p for p in S.cand if S.isin(p) is False]
    if ins:
        allowed = set(ins) | set(unk)
        rc = reach([ins[0]], allowed)
        if any(p not in rc for p in ins): raise Contradiction("inside disconnected")
        for p in unk:
            if p not in rc: ch |= S.restrict(p, {0}, "topo: cannot connect to region")
        # articulation: unknown u whose removal disconnects known-ins
        for u in unk:
            if S.isin(u) is not None: continue
            cur_ins = [p for p in S.cand if S.isin(p) is True]
            al = set(p for p in S.cand if S.isin(p) is not False) - {u}
            rc2 = reach([cur_ins[0]], al)
            if any(p not in rc2 for p in cur_ins):
                ch |= S.restrict(u, S.cand[u]-{0}, "topo: region needs this cell to stay connected")
    # outside
    outs = [p for p in S.cand if S.isin(p) is False]; unk = [p for p in S.cand if S.isin(p) is None]
    allowed = set(outs) | set(unk) | {'EXT'}
    rc = reach(['EXT'], allowed, ext_ok=True)
    if any(p not in rc for p in outs): raise Contradiction("outside pocket")
    for p in unk:
        if p not in rc: ch |= S.restrict(p, S.cand[p]-{0}, "topo: would be a hole")
    for u in unk:
        if S.isin(u) is not None: continue
        cur_outs = [p for p in S.cand if S.isin(p) is False]
        al = (set(p for p in S.cand if S.isin(p) is not True) | {'EXT'}) - {u}
        rc2 = reach(['EXT'], al, ext_ok=True)
        if any(p not in rc2 for p in cur_outs):
            ch |= S.restrict(u, {0}, "topo: outside cells need this exit")
    return ch

# ---------- unit: line (CP-SAT over one row/column; optional 1/2/3 with neighbour status)
def line_model(S, tag, clues, with123=False):
    m = cp_model.CpModel()
    cells = line_cells(tag)
    vv = {}; xb = {}
    for p in cells:
        vv[p] = m.NewIntVarFromDomain(cp_model.Domain.FromValues(sorted(S.cand[p])), "")
        for d in range(1,10):
            b = m.NewBoolVar(""); m.Add(vv[p]==d).OnlyEnforceIf(b); m.Add(vv[p]!=d).OnlyEnforceIf(b.Not()); xb[p,d]=b
    for d in range(1,10): m.Add(sum(xb[p,d] for p in cells) <= 1)
    ins = {}
    for p in cells:
        b = m.NewBoolVar(""); m.Add(vv[p] >= 1).OnlyEnforceIf(b); m.Add(vv[p] == 0).OnlyEnforceIf(b.Not()); ins[p] = b
    letters_here = sorted(set(ch for cl in clues for ch in cl if ch != '?'))
    L = {ch: m.NewIntVarFromDomain(cp_model.Domain.FromValues(sorted(S.lc[ch])), ch) for ch in letters_here}
    if len(L) > 1: m.AddAllDifferent(list(L.values()))
    k = len(clues); n = len(cells)
    start = []
    for i in range(n):
        s = m.NewBoolVar("")
        if i == 0: m.Add(s == ins[cells[0]])
        else:
            m.AddBoolAnd([ins[cells[i]], ins[cells[i-1]].Not()]).OnlyEnforceIf(s)
            m.AddBoolOr([ins[cells[i]].Not(), ins[cells[i-1]], s])
        start.append(s)
    m.Add(sum(start) == k)
    cnt = [m.NewIntVar(0,k,"") for i in range(n)]
    for i in range(n): m.Add(cnt[i] == sum(start[:i+1]))
    for gi in range(1,k+1):
        tok = clues[gi-1]; digs = []
        for ch in tok:
            if ch == '?': digs.append(m.NewIntVar(0,9,""))
            else: digs.append(L[ch])
        m.Add(digs[0] >= 1)
        val = sum(dv*10**(len(digs)-1-i) for i,dv in enumerate(digs))
        contrib = []
        for i in range(n):
            eq = m.NewBoolVar(""); m.Add(cnt[i]==gi).OnlyEnforceIf(eq); m.Add(cnt[i]!=gi).OnlyEnforceIf(eq.Not())
            w = m.NewIntVar(0,9,""); m.Add(w == vv[cells[i]]).OnlyEnforceIf(eq); m.Add(w == 0).OnlyEnforceIf(eq.Not())
            contrib.append(w)
        m.Add(sum(contrib) == val)
    nbvars = {}
    if with123:
        def stat(q):
            if not (1<=q[0]<=N and 1<=q[1]<=N): return 0
            if q in ins: return ins[q]
            st = S.isin(q)
            if st is True: return 1
            if st is False: return 0
            if q not in nbvars: nbvars[q] = m.NewBoolVar("")
            return nbvars[q]
        for p in cells:
            outs = []
            for dr,dc in NB:
                q = (p[0]+dr,p[1]+dc); s_ = stat(q)
                outs.append(1 - s_)
            for d in (1,2,3): m.Add(sum(outs) == d).OnlyEnforceIf(xb[p,d])
    return m, vv, L, nbvars

LINE_CACHE = {}
def line_sig(S, tag, clues, with123):
    cells = line_cells(tag)
    sig = [tuple(sorted(S.cand[p])) for p in cells]
    if with123:
        for p in cells:
            for dr,dc in NB:
                q=(p[0]+dr,p[1]+dc); sig.append(S.isin(q) if q not in cells else 'L')
    sig += [tuple(sorted(S.lc[ch])) for ch in sorted(set(x for cl in clues for x in cl if x!='?'))]
    return (tag, with123, tuple(sig))
def unit_line(S, tag, clues, with123=False, tlimit=20):
    key = line_sig(S, tag, clues, with123)
    if key in LINE_CACHE and LINE_CACHE[key] is None: return False
    m, vv, L, nbv = line_model(S, tag, clues, with123)
    sol = cp_model.CpSolver(); sol.parameters.num_workers = 1; sol.parameters.max_time_in_seconds = tlimit
    seen = {p: set() for p in vv}; seenL = {ch: set() for ch in L}; seenN = {q: set() for q in nbv}
    def rec():
        for p in vv: seen[p].add(sol.Value(vv[p]))
        for ch in L: seenL[ch].add(sol.Value(L[ch]))
        for q in nbv: seenN[q].add(sol.Value(nbv[q]))
    st = sol.Solve(m)
    if st == cp_model.INFEASIBLE: raise Contradiction(f"line {tag} infeasible")
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): return False
    rec()
    LIGHT = globals().get('LIGHT_MODE', False)
    tests = []
    for p in vv:
        cs = S.cand[p]
        if LIGHT and 0 in cs and len(cs) > 3:
            tests += [('c',p,0)] + [('cin',p,1)]
        else:
            tests += [('c',p,v) for v in cs]
    tests += [('l',ch,v) for ch in L for v in S.lc[ch]] + [('n',q,v) for q in nbv for v in (0,1)]
    for kind, key, val in tests:
        if kind=='c' and val in seen[key]: continue
        if kind=='cin':
            if any(x > 0 for x in seen[key]): continue
            b = m.NewBoolVar(""); m.Add(vv[key] >= 1).OnlyEnforceIf(b)
            m.ClearAssumptions(); m.AddAssumption(b)
            st = sol.Solve(m)
            if st in (cp_model.OPTIMAL, cp_model.FEASIBLE): rec()
            elif st == cp_model.UNKNOWN: seen[key] |= (S.cand[key] - {0})
            m.ClearAssumptions(); continue
        if kind=='l' and val in seenL[key]: continue
        if kind=='n' and val in seenN[key]: continue
        var = vv[key] if kind=='c' else L[key] if kind=='l' else nbv[key]
        b = m.NewBoolVar(""); m.Add(var == val).OnlyEnforceIf(b)
        m.ClearAssumptions(); m.AddAssumption(b)
        st = sol.Solve(m)
        if st in (cp_model.OPTIMAL, cp_model.FEASIBLE): rec()
        elif st == cp_model.UNKNOWN: (seen if kind=='c' else seenL if kind=='l' else seenN)[key].add(val)
        m.ClearAssumptions()
    ch = False
    why = f"line {tag}" + (" +123" if with123 else "")
    LAST_PATTERNS[(tag, with123)] = None
    for p in vv:
        keep = set(seen[p])
        if globals().get('LIGHT_MODE', False) and 0 in S.cand[p] and len(S.cand[p]) > 3 and any(x > 0 for x in keep):
            keep |= (S.cand[p] - {0})
        ch |= S.restrict(p, keep, why)
    for c_ in L: ch |= S.lrestrict(c_, seenL[c_], why)
    for q in nbv:
        if seenN[q] == {1}: ch |= S.restrict(q, S.cand[q]-{0}, why+" (neighbour)")
        if seenN[q] == {0}: ch |= S.restrict(q, {0}, why+" (neighbour)")
    if not ch: LINE_CACHE[key] = None
    return ch
LAST_PATTERNS = {}
def line_patterns(S, tag, clues, with123=False, cap=40):
    """Enumerate distinct in/out patterns of the line consistent with the line unit (for visualisation)."""
    m, vv, L, nbv = line_model(S, tag, clues, with123)
    ins = [m.NewBoolVar("") for p in vv]
    cells = list(vv)
    for b,p in zip(ins, cells):
        m.Add(vv[p] >= 1).OnlyEnforceIf(b); m.Add(vv[p] == 0).OnlyEnforceIf(b.Not())
    sol = cp_model.CpSolver(); sol.parameters.num_workers = 1; sol.parameters.max_time_in_seconds = 20
    pats = []
    while len(pats) < cap:
        st = sol.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): break
        pat = tuple(sol.Value(b) for b in ins); pats.append((pat, {p: sol.Value(vv[p]) for p in cells}))
        m.AddBoolOr([b.Not() if x else b for b,x in zip(ins, pat)])
    return pats

def propagate(S, level, verbose=False, record=None):
    """level 1: cheap units; 2: + pure line units; 3: + line units with 123."""
    while True:
        progress = False
        for name, fn in [('letters', unit_letters), ('latin', unit_latin), ('123', unit_123), ('2x2', unit_2x2), ('topo', unit_topo)]:
            n0 = len(S.log)
            while fn(S): pass
            if len(S.log) > n0: progress = True
        if progress: continue
        if level >= 2:
            for tag, cl in LINES:
                n0 = len(S.log)
                if unit_line(S, tag, cl, False): 
                    progress = True
                    if record is not None: record.append(('line', tag, S.log[n0:]))
                    break
            if progress: continue
        if level >= 3:
            for tag, cl in LINES:
                n0 = len(S.log)
                if unit_line(S, tag, cl, True):
                    progress = True
                    if record is not None: record.append(('line123', tag, S.log[n0:]))
                    break
            if progress: continue
        return

def solved(S):
    return all(len(v)==1 for v in S.cand.values())
