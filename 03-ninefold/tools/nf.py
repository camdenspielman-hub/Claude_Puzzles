"""
Ninefold puzzle tooling.

- Geometry: n x n grids with rectangular boxes (or custom regions).
- Constraints: every rule type used in the game, each with
    prune(st)   human-style candidate filtering (logs what it did)
    ok(sol)     full-solution check
    cp(m, X, B) CP-SAT encoding (X = int vars, B[c][d] = bool "cell c holds d")
    js()        JSON for the front-end
- Logical solver: singles -> constraint filters -> locked candidates -> subsets.
- CP-SAT: uniqueness and forced-cell analysis.
"""
import itertools, json, random
from ortools.sat.python import cp_model


def bit(d):
    return 1 << (d - 1)


def digs(m):
    out = []
    d = 1
    while m:
        if m & 1:
            out.append(d)
        m >>= 1
        d += 1
    return out


def pc(m):
    return m.bit_count()


def lo(m):
    return (m & -m).bit_length()


def hi(m):
    return m.bit_length()


class Contradiction(Exception):
    pass


class Abort(Exception):
    pass


class Done(Exception):
    pass


def rc(cell, n=9):
    return f"r{cell // n + 1}c{cell % n + 1}"


# --------------------------------------------------------------------------- geometry
class Geo:
    def __init__(self, n=9, bh=None, bw=None, regions=None, extra_houses=()):
        self.n = n
        self.NC = n * n
        self.ALL = (1 << n) - 1
        if regions is None:
            if bh is None:
                bh = {4: 2, 6: 2, 9: 3}[n]
                bw = {4: 2, 6: 3, 9: 3}[n]
            regions = [(r // bh) * (n // bw) + (c // bw) for r in range(n) for c in range(n)]
        self.region = regions
        rows = [[r * n + c for c in range(n)] for r in range(n)]
        cols = [[r * n + c for r in range(n)] for c in range(n)]
        nb = max(regions) + 1
        boxes = [[i for i in range(self.NC) if regions[i] == b] for b in range(nb)]
        self.rows, self.cols, self.boxes = rows, cols, boxes
        self.houses = rows + cols + boxes + [list(h) for h in extra_houses]
        self.house_names = ([f"row {r+1}" for r in range(n)] + [f"column {c+1}" for c in range(n)]
                            + [f"box {b+1}" for b in range(nb)]
                            + [f"extra region {i+1}" for i in range(len(extra_houses))])
        self.peers = [set() for _ in range(self.NC)]
        for h in self.houses:
            for a in h:
                for b in h:
                    if a != b:
                        self.peers[a].add(b)
        self.cell_houses = [[i for i, h in enumerate(self.houses) if c in h] for c in range(self.NC)]

    def sees(self, a, b):
        return b in self.peers[a]

    def nbrs(self, cell):
        n = self.n
        r, c = divmod(cell, n)
        out = []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            rr, cc = r + dr, c + dc
            if 0 <= rr < n and 0 <= cc < n:
                out.append(rr * n + cc)
        return out

    def name(self, cell):
        return rc(cell, self.n)


def C(r, c, n=9):
    """1-indexed (r, c) -> cell index"""
    return (r - 1) * n + (c - 1)


def parse_cells(s, n=9):
    """'r1c1 r1c2' or [(1,1),(1,2)] -> [cells]"""
    if isinstance(s, str):
        out = []
        for tok in s.replace(",", " ").split():
            tok = tok.lower()
            r = int(tok[1:tok.index("c")])
            c = int(tok[tok.index("c") + 1:])
            out.append(C(r, c, n))
        return out
    return [C(r, c, n) for r, c in s]


# --------------------------------------------------------------------------- solver state
class State:
    def __init__(self, geo, constraints, givens=None, cand=None, log=True):
        self.geo = geo
        self.cons = list(constraints)
        self.cand = list(cand) if cand is not None else [geo.ALL] * geo.NC
        self.logging = log
        self.log = []
        self.placed = set()          # cells whose single has been propagated
        self.step_reason = None
        if givens:
            for c, v in givens.items():
                if not (self.cand[c] & bit(v)):
                    raise Contradiction(f"given {v} at {geo.name(c)} impossible")
                self.cand[c] = bit(v)

    def copy(self):
        s = State(self.geo, self.cons, cand=self.cand, log=False)
        s.placed = set(self.placed)
        return s

    # restrict cell to mask; returns True if changed
    def restrict(self, cell, mask, why):
        old = self.cand[cell]
        new = old & mask
        if new == old:
            return False
        if new == 0:
            raise Contradiction(f"{why}: {self.geo.name(cell)} emptied")
        self.cand[cell] = new
        if self.logging:
            self.log.append(("elim", cell, old & ~new, why))
        return True

    def solved(self):
        return all(pc(m) == 1 for m in self.cand)

    def value(self, cell):
        m = self.cand[cell]
        return lo(m) if pc(m) == 1 else 0

    def grid_str(self):
        return "".join(str(self.value(c)) if self.value(c) else "." for c in range(self.geo.NC))

    # ---------------------------------------------------------------- basic techniques
    def naked_singles(self):
        changed = False
        for c in range(self.geo.NC):
            m = self.cand[c]
            if pc(m) == 1 and c not in self.placed:
                self.placed.add(c)
                if self.logging:
                    self.log.append(("place", c, lo(m), "single"))
                for p in self.geo.peers[c]:
                    if self.cand[p] & m:
                        self.restrict(p, ~m, f"{self.geo.name(c)}={lo(m)} sees it")
                        changed = True
        return changed

    def hidden_singles(self):
        changed = False
        g = self.geo
        for hi_, h in enumerate(g.houses):
            if len(h) != g.n:
                continue
            for d in range(1, g.n + 1):
                b = bit(d)
                where = [c for c in h if self.cand[c] & b]
                if not where:
                    raise Contradiction(f"no place for {d} in {g.house_names[hi_]}")
                if len(where) == 1 and pc(self.cand[where[0]]) > 1:
                    self.restrict(where[0], b, f"hidden single {d} in {g.house_names[hi_]}")
                    changed = True
        return changed

    def locked_candidates(self):
        g = self.geo
        changed = False
        for hi_, h in enumerate(g.houses):
            if len(h) != g.n:
                continue
            hs = set(h)
            for d in range(1, g.n + 1):
                b = bit(d)
                where = [c for c in h if self.cand[c] & b]
                if len(where) < 2 or any(pc(self.cand[c]) == 1 for c in where):
                    continue
                # common peers of all `where` cells outside this house
                common = set.intersection(*[g.peers[c] for c in where]) - hs
                for p in common:
                    if self.cand[p] & b:
                        self.restrict(p, ~b, f"{d} locked in {g.house_names[hi_]} at {','.join(g.name(c) for c in where)}")
                        changed = True
        return changed

    def subsets(self, maxk=4):
        g = self.geo
        changed = False
        for hi_, h in enumerate(g.houses):
            if len(h) != g.n:
                continue
            open_cells = [c for c in h if pc(self.cand[c]) > 1]
            for k in range(2, min(maxk, len(open_cells) - 1) + 1):
                # naked
                for combo in itertools.combinations(open_cells, k):
                    u = 0
                    for c in combo:
                        u |= self.cand[c]
                    if pc(u) == k:
                        for c in open_cells:
                            if c not in combo and self.cand[c] & u:
                                self.restrict(c, ~u, f"naked set {digs(u)} in {g.house_names[hi_]}")
                                changed = True
                if changed:
                    return True
                # hidden
                open_digits = [d for d in range(1, g.n + 1) if sum(1 for c in h if self.cand[c] & bit(d)) > 1]
                for combo in itertools.combinations(open_digits, k):
                    m = 0
                    for d in combo:
                        m |= bit(d)
                    where = [c for c in h if self.cand[c] & m]
                    if len(where) == k:
                        for c in where:
                            if self.cand[c] & ~m:
                                self.restrict(c, m, f"hidden set {list(combo)} in {g.house_names[hi_]}")
                                changed = True
                if changed:
                    return True
        return changed

    def constraint_pass(self, tier):
        for con in self.cons:
            if con.tier != tier:
                continue
            if con.prune(self):
                return True
        return False

    def propagate(self, max_tier=3, use_subsets=True, max_rounds=100000):
        """Run human-style logic to a fixpoint. Returns True if solved."""
        rounds = 0
        while True:
            rounds += 1
            if rounds > max_rounds:
                break
            if self.naked_singles():
                continue
            if self.hidden_singles():
                continue
            progressed = False
            for t in range(1, max_tier + 1):
                if self.constraint_pass(t):
                    progressed = True
                    break
            if progressed:
                continue
            if self.locked_candidates():
                continue
            if use_subsets and self.subsets():
                continue
            break
        return self.solved()


# --------------------------------------------------------------------------- generic enumeration
def enum_gac(st, cells, partial_ok=None, full_ok=None, all_distinct=False, limit=300000, order=None):
    """Return list of supported masks per cell (aligned with `cells`), or None on abort."""
    g = st.geo
    k = len(cells)
    idx = list(range(k)) if order is None else list(order)
    pos_cells = [cells[i] for i in idx]
    lists = [digs(st.cand[c]) for c in pos_cells]
    sees = []
    for i in range(k):
        s = []
        for j in range(i):
            if all_distinct or g.sees(pos_cells[i], pos_cells[j]) or pos_cells[i] == pos_cells[j]:
                s.append(j)
        sees.append(s)
    vals = [0] * k
    support = [0] * k
    target = [st.cand[c] for c in pos_cells]
    nodes = [0]

    def rec(i):
        if i == k:
            if full_ok is None or full_ok(vals):
                for t in range(k):
                    support[t] |= 1 << (vals[t] - 1)
                if support == target:
                    raise Done
            return
        for v in lists[i]:
            nodes[0] += 1
            if nodes[0] > limit:
                raise Abort
            bad = False
            for j in sees[i]:
                if vals[j] == v:
                    bad = True
                    break
            if bad:
                continue
            vals[i] = v
            if partial_ok is None or partial_ok(vals, i):
                rec(i + 1)
        vals[i] = 0

    try:
        rec(0)
    except Done:
        pass
    except Abort:
        return None
    out = [0] * k
    for t in range(k):
        out[idx[t]] = support[t]
    return out


def apply_support(st, cells, sup, why):
    if sup is None:
        return False
    changed = False
    for c, m in zip(cells, sup):
        if m == 0:
            raise Contradiction(f"{why}: no valid fill")
    for c, m in zip(cells, sup):
        if st.restrict(c, m, why):
            changed = True
    return changed


def pair_ac(st, a, b, rel, why):
    g = st.geo
    sees = g.sees(a, b)
    ca, cb = st.cand[a], st.cand[b]
    na = nb = 0
    for va in digs(ca):
        for vb in digs(cb):
            if sees and va == vb:
                continue
            if rel(va, vb):
                na |= bit(va)
                nb |= bit(vb)
    ch = st.restrict(a, na, why)
    ch = st.restrict(b, nb, why) or ch
    return ch


# --------------------------------------------------------------------------- constraints
class Con:
    tier = 1
    kind = "?"
    label = ""

    def all_cells(self):
        return list(self.cells)

    def js(self):
        raise NotImplementedError


def cells_js(cells, n=9):
    return [[c // n, c % n] for c in cells]


class Killer(Con):
    kind = "killer"

    def __init__(self, cells, total):
        self.cells = list(cells)
        self.total = total

    @property
    def label(self):
        return f"cage {self.total}"

    def prune(self, st):
        cells = self.cells
        T = self.total
        k = len(cells)
        mins = [lo(st.cand[c]) for c in cells]
        maxs = [hi(st.cand[c]) for c in cells]
        # order: fewest candidates first
        order = sorted(range(k), key=lambda i: pc(st.cand[cells[i]]))
        rest_min = [0] * (k + 1)
        rest_max = [0] * (k + 1)
        for t in range(k - 1, -1, -1):
            rest_min[t] = rest_min[t + 1] + mins[order[t]]
            rest_max[t] = rest_max[t + 1] + maxs[order[t]]

        def pok(vals, i):
            s = sum(vals[: i + 1])
            return s + rest_min[i + 1] <= T <= s + rest_max[i + 1]

        sup = enum_gac(st, cells, pok, lambda v: sum(v) == T, all_distinct=True, order=order)
        return apply_support(st, cells, sup, f"cage {T} at {st.geo.name(cells[0])}")

    def ok(self, sol):
        v = [sol[c] for c in self.cells]
        return sum(v) == self.total and len(set(v)) == len(v)

    def cp(self, m, X, B):
        m.Add(sum(X[c] for c in self.cells) == self.total)
        m.AddAllDifferent([X[c] for c in self.cells])

    def js(self):
        return {"type": "killer", "cells": cells_js(self.cells), "sum": self.total}


class Thermo(Con):
    kind = "thermo"

    def __init__(self, cells):
        self.cells = list(cells)

    def prune(self, st):
        ch = False
        cells = self.cells
        # bounds both ways
        for i in range(1, len(cells)):
            a, b = cells[i - 1], cells[i]
            ch = st.restrict(b, ~((1 << lo(st.cand[a])) - 1) & st.geo.ALL, f"thermo from {st.geo.name(cells[0])}") or ch
        for i in range(len(cells) - 2, -1, -1):
            a, b = cells[i], cells[i + 1]
            ch = st.restrict(a, (1 << (hi(st.cand[b]) - 1)) - 1, f"thermo from {st.geo.name(cells[0])}") or ch
        return ch

    def ok(self, sol):
        v = [sol[c] for c in self.cells]
        return all(v[i] < v[i + 1] for i in range(len(v) - 1))

    def cp(self, m, X, B):
        for a, b in zip(self.cells, self.cells[1:]):
            m.Add(X[a] < X[b])

    def js(self):
        return {"type": "thermo", "cells": cells_js(self.cells)}


class Arrow(Con):
    kind = "arrow"

    def __init__(self, circle, cells):
        self.circle = circle
        self.cells = [circle] + list(cells)
        self.shaft = list(cells)

    def prune(self, st):
        allc = self.cells
        k = len(allc)
        maxs = [hi(st.cand[c]) for c in allc]
        mins = [lo(st.cand[c]) for c in allc]
        rest_min = [0] * (k + 1)
        rest_max = [0] * (k + 1)
        for t in range(k - 1, 0, -1):
            rest_min[t] = rest_min[t + 1] + mins[t]
            rest_max[t] = rest_max[t + 1] + maxs[t]

        def pok(vals, i):
            if i == 0:
                return rest_min[1] <= vals[0] <= rest_max[1]
            s = sum(vals[1: i + 1])
            return s + rest_min[i + 1] <= vals[0] <= s + rest_max[i + 1]

        sup = enum_gac(st, allc, pok, lambda v: sum(v[1:]) == v[0])
        return apply_support(st, allc, sup, f"arrow at {st.geo.name(self.circle)}")

    def ok(self, sol):
        return sol[self.circle] == sum(sol[c] for c in self.shaft)

    def cp(self, m, X, B):
        m.Add(X[self.circle] == sum(X[c] for c in self.shaft))

    def js(self):
        return {"type": "arrow", "circle": cells_js([self.circle])[0], "cells": cells_js(self.shaft)}


class Pair(Con):
    """Edge clue between two orthogonal cells."""
    kind = "pair"

    def __init__(self, a, b, what):
        self.cells = [a, b]
        self.what = what  # 'X','V','white','black'
        self.rel = {
            "X": lambda x, y: x + y == 10,
            "V": lambda x, y: x + y == 5,
            "white": lambda x, y: abs(x - y) == 1,
            "black": lambda x, y: x == 2 * y or y == 2 * x,
        }[what]

    def prune(self, st):
        a, b = self.cells
        return pair_ac(st, a, b, self.rel, f"{self.what} between {st.geo.name(a)},{st.geo.name(b)}")

    def ok(self, sol):
        return self.rel(sol[self.cells[0]], sol[self.cells[1]])

    def cp(self, m, X, B):
        a, b = self.cells
        if self.what == "X":
            m.Add(X[a] + X[b] == 10)
        elif self.what == "V":
            m.Add(X[a] + X[b] == 5)
        elif self.what == "white":
            t = m.NewBoolVar("")
            m.Add(X[a] - X[b] == 1).OnlyEnforceIf(t)
            m.Add(X[b] - X[a] == 1).OnlyEnforceIf(t.Not())
        else:
            t = m.NewBoolVar("")
            m.Add(X[a] == 2 * X[b]).OnlyEnforceIf(t)
            m.Add(X[b] == 2 * X[a]).OnlyEnforceIf(t.Not())

    def js(self):
        return {"type": {"X": "x", "V": "v", "white": "kwhite", "black": "kblack"}[self.what],
                "cells": cells_js(self.cells)}


class Line(Con):
    """Generic line with an order-based partial check."""
    kind = "line"
    limit = 300000

    def __init__(self, cells):
        self.cells = list(cells)

    def pok(self, vals, i):
        return True

    def fok(self, vals):
        return True

    def prune(self, st):
        sup = enum_gac(st, self.cells, self.pok, self.fok, all_distinct=self.distinct_all(), limit=self.limit)
        return apply_support(st, self.cells, sup, f"{self.kind} line at {st.geo.name(self.cells[0])}")

    def distinct_all(self):
        return False

    def ok(self, sol):
        v = [sol[c] for c in self.cells]
        for i in range(len(v)):
            if not self.pok(v, i):
                return False
        if self.distinct_all() and len(set(v)) != len(v):
            return False
        return self.fok(v)

    def js(self):
        return {"type": self.kind, "cells": cells_js(self.cells)}


class Whisper(Line):
    kind = "whisper"

    def __init__(self, cells, gap=5):
        super().__init__(cells)
        self.gap = gap
        if gap == 4:
            self.kind = "dutch"

    def pok(self, v, i):
        return i == 0 or abs(v[i] - v[i - 1]) >= self.gap

    def cp(self, m, X, B):
        for a, b in zip(self.cells, self.cells[1:]):
            d = m.NewIntVar(0, 8, "")
            m.AddAbsEquality(d, X[a] - X[b])
            m.Add(d >= self.gap)


class Renban(Line):
    kind = "renban"

    def distinct_all(self):
        return True

    def pok(self, v, i):
        s = v[: i + 1]
        return max(s) - min(s) <= len(self.cells) - 1

    def cp(self, m, X, B):
        xs = [X[c] for c in self.cells]
        m.AddAllDifferent(xs)
        mx = m.NewIntVar(1, 9, "")
        mn = m.NewIntVar(1, 9, "")
        m.AddMaxEquality(mx, xs)
        m.AddMinEquality(mn, xs)
        m.Add(mx - mn == len(xs) - 1)


class Nabner(Line):
    kind = "nabner"

    def distinct_all(self):
        return True

    def pok(self, v, i):
        return all(abs(v[i] - v[j]) > 1 for j in range(i))

    def cp(self, m, X, B):
        xs = [X[c] for c in self.cells]
        for a, b in itertools.combinations(xs, 2):
            d = m.NewIntVar(0, 8, "")
            m.AddAbsEquality(d, a - b)
            m.Add(d >= 2)


class Palindrome(Line):
    kind = "palindrome"

    def pok(self, v, i):
        L = len(self.cells)
        j = L - 1 - i
        if j < i:
            return v[i] == v[j]
        return True

    def cp(self, m, X, B):
        L = len(self.cells)
        for i in range(L // 2):
            m.Add(X[self.cells[i]] == X[self.cells[L - 1 - i]])


class Parity(Line):
    kind = "parity"

    def pok(self, v, i):
        return i == 0 or (v[i] + v[i - 1]) % 2 == 1

    def cp(self, m, X, B):
        for a, b in zip(self.cells, self.cells[1:]):
            t = m.NewIntVar(0, 9, "")
            m.Add(X[a] + X[b] == 2 * t + 1)


class Entropic(Line):
    kind = "entropic"

    @staticmethod
    def cls(v):
        return (v - 1) // 3

    def pok(self, v, i):
        if i < 1:
            return True
        k = self.cls
        if k(v[i]) == k(v[i - 1]):
            return False
        if i >= 2 and k(v[i]) == k(v[i - 2]):
            return False
        return True

    def cp(self, m, X, B):
        ks = []
        for c in self.cells:
            k = m.NewIntVar(0, 2, "")
            m.AddDivisionEquality(k, X[c] - 1, 3)
            ks.append(k)
        for i in range(len(ks) - 2):
            m.AddAllDifferent(ks[i:i + 3])
        if len(ks) == 2:
            m.Add(ks[0] != ks[1])


class Modular(Entropic):
    kind = "modular"

    @staticmethod
    def cls(v):
        return v % 3

    def cp(self, m, X, B):
        ks = []
        for c in self.cells:
            k = m.NewIntVar(0, 2, "")
            m.AddModuloEquality(k, X[c], 3)
            ks.append(k)
        for i in range(len(ks) - 2):
            m.AddAllDifferent(ks[i:i + 3])
        if len(ks) == 2:
            m.Add(ks[0] != ks[1])


class Zipper(Line):
    kind = "zipper"

    def pok(self, v, i):
        L = len(self.cells)
        j = L - 1 - i
        if j < i:
            s = v[i] + v[j]
            if L % 2 == 1:
                return s == v[L // 2]
            # compare with first pair
            return s == v[0] + v[L - 1]
        return True

    def cp(self, m, X, B):
        L = len(self.cells)
        c = self.cells
        if L % 2 == 1:
            for i in range(L // 2):
                m.Add(X[c[i]] + X[c[L - 1 - i]] == X[c[L // 2]])
        else:
            for i in range(1, L // 2):
                m.Add(X[c[i]] + X[c[L - 1 - i]] == X[c[0]] + X[c[L - 1]])


class RegionSum(Line):
    kind = "regionsum"

    def __init__(self, cells, geo):
        super().__init__(cells)
        self.segs = []
        cur = [0]
        for i in range(1, len(cells)):
            if geo.region[cells[i]] != geo.region[cells[i - 1]]:
                self.segs.append(cur)
                cur = []
            cur.append(i)
        self.segs.append(cur)
        self.seg_end = {s[-1]: si for si, s in enumerate(self.segs)}
        self.seg_of = {}
        for si, s in enumerate(self.segs):
            for i in s:
                self.seg_of[i] = si

    def pok(self, v, i):
        if i in self.seg_end:
            si = self.seg_end[i]
            if si > 0:
                s0 = sum(v[j] for j in self.segs[0])
                return sum(v[j] for j in self.segs[si]) == s0
        return True

    def cp(self, m, X, B):
        sums = [sum(X[self.cells[j]] for j in s) for s in self.segs]
        for s in sums[1:]:
            m.Add(s == sums[0])


class Between(Line):
    kind = "between"

    def prune(self, st):
        c = self.cells
        order = [0, len(c) - 1] + list(range(1, len(c) - 1))
        sup = enum_gac(st, c, self._pok, None, order=order, limit=self.limit)
        return apply_support(st, c, sup, f"between line at {st.geo.name(c[0])}")

    def _pok(self, v, i):
        # order positions: 0 -> end A, 1 -> end B, then interior
        if i == 0:
            return True
        a, b = v[0], v[1]
        if i == 1:
            return abs(a - b) >= 2
        lo_, hi_ = min(a, b), max(a, b)
        return lo_ < v[i] < hi_

    def ok(self, sol):
        v = [sol[x] for x in self.cells]
        a, b = v[0], v[-1]
        return all(min(a, b) < x < max(a, b) for x in v[1:-1])

    def cp(self, m, X, B):
        a, b = X[self.cells[0]], X[self.cells[-1]]
        mn = m.NewIntVar(1, 9, "")
        mx = m.NewIntVar(1, 9, "")
        m.AddMinEquality(mn, [a, b])
        m.AddMaxEquality(mx, [a, b])
        for c in self.cells[1:-1]:
            m.Add(X[c] > mn)
            m.Add(X[c] < mx)


class LittleKiller(Con):
    kind = "littlekiller"

    def __init__(self, cells, total, clue_pos, direction):
        self.cells = list(cells)
        self.total = total
        self.clue_pos = clue_pos   # (r, c) outside grid, 0-indexed (can be -1 or 9)
        self.direction = direction  # (dr, dc)

    def prune(self, st):
        cells = self.cells
        T = self.total
        k = len(cells)
        mins = [lo(st.cand[c]) for c in cells]
        maxs = [hi(st.cand[c]) for c in cells]
        rmin = [0] * (k + 1)
        rmax = [0] * (k + 1)
        for t in range(k - 1, -1, -1):
            rmin[t] = rmin[t + 1] + mins[t]
            rmax[t] = rmax[t + 1] + maxs[t]

        def pok(v, i):
            s = sum(v[: i + 1])
            return s + rmin[i + 1] <= T <= s + rmax[i + 1]

        sup = enum_gac(st, cells, pok, lambda v: sum(v) == T)
        return apply_support(st, cells, sup, f"little killer {T}")

    def ok(self, sol):
        return sum(sol[c] for c in self.cells) == self.total

    def cp(self, m, X, B):
        m.Add(sum(X[c] for c in self.cells) == self.total)

    def js(self):
        return {"type": "littlekiller", "cells": cells_js(self.cells), "sum": self.total,
                "clue": list(self.clue_pos), "dir": list(self.direction)}


class Outside(Con):
    """Row/column clue seen from one side. cells are in viewing order."""
    tier = 2

    def __init__(self, cells, value, side):
        self.cells = list(cells)
        self.value = value
        self.side = side  # e.g. ('L', row) / ('R', row) / ('T', col) / ('B', col), 0-indexed

    def js(self):
        return {"type": self.kind, "cells": cells_js(self.cells), "value": self.value,
                "side": self.side[0], "index": self.side[1]}


class Sandwich(Outside):
    kind = "sandwich"

    def prune(self, st):
        cells = self.cells
        S = self.value
        n = len(cells)
        sup = [0] * n
        mid = 0
        for d in range(2, 9):
            mid |= bit(d)
        any_ok = False
        for p1 in range(n):
            if not st.cand[cells[p1]] & bit(1):
                continue
            for p9 in range(n):
                if p9 == p1 or not st.cand[cells[p9]] & bit(9):
                    continue
                a, b = min(p1, p9), max(p1, p9)
                inner = list(range(a + 1, b))
                outer = [i for i in range(n) if i not in inner and i != p1 and i != p9]
                if not inner:
                    if S != 0:
                        continue
                    tuples_sup = []
                    okk = True
                    for i in outer:
                        if not st.cand[cells[i]] & mid:
                            okk = False
                    if not okk:
                        continue
                    any_ok = True
                    sup[p1] |= bit(1)
                    sup[p9] |= bit(9)
                    for i in outer:
                        sup[i] |= st.cand[cells[i]] & mid
                    continue
                if len(inner) > 7:
                    continue
                # enumerate inner tuples
                lists = [digs(st.cand[cells[i]] & mid) for i in inner]
                found = []
                insup = [0] * len(inner)
                used_union = []

                def rec(j, s, used, vals):
                    if s > S:
                        return
                    if j == len(inner):
                        if s == S:
                            for t, v in enumerate(vals):
                                insup[t] |= bit(v)
                            used_union.append(used)
                        return
                    for v in lists[j]:
                        if used & bit(v):
                            continue
                        vals.append(v)
                        rec(j + 1, s + v, used | bit(v), vals)
                        vals.pop()

                rec(0, 0, 0, [])
                if not used_union:
                    continue
                # outer cells: any mid digit not used by at least one tuple
                okk = True
                osup = {}
                for i in outer:
                    m_ = 0
                    for u in used_union:
                        m_ |= st.cand[cells[i]] & mid & ~u
                    if not m_:
                        okk = False
                        break
                    osup[i] = m_
                if not okk:
                    continue
                any_ok = True
                sup[p1] |= bit(1)
                sup[p9] |= bit(9)
                for t, i in enumerate(inner):
                    sup[i] |= insup[t]
                for i, m_ in osup.items():
                    sup[i] |= m_
        if not any_ok:
            raise Contradiction(f"sandwich {S} impossible")
        return apply_support(st, cells, sup, f"sandwich {S} ({self.side[0]}{self.side[1]+1})")

    def ok(self, sol):
        v = [sol[c] for c in self.cells]
        a, b = sorted((v.index(1), v.index(9)))
        return sum(v[a + 1:b]) == self.value

    def cp(self, m, X, B):
        n = len(self.cells)
        p1 = m.NewIntVar(0, n - 1, "")
        p9 = m.NewIntVar(0, n - 1, "")
        for i, c in enumerate(self.cells):
            m.Add(p1 == i).OnlyEnforceIf(B[c][1])
            m.Add(p9 == i).OnlyEnforceIf(B[c][9])
        lo_ = m.NewIntVar(0, n - 1, "")
        hi_ = m.NewIntVar(0, n - 1, "")
        m.AddMinEquality(lo_, [p1, p9])
        m.AddMaxEquality(hi_, [p1, p9])
        ys = []
        for i, c in enumerate(self.cells):
            inb = m.NewBoolVar("")
            g1 = m.NewBoolVar("")
            g2 = m.NewBoolVar("")
            m.Add(lo_ < i).OnlyEnforceIf(g1)
            m.Add(lo_ >= i).OnlyEnforceIf(g1.Not())
            m.Add(hi_ > i).OnlyEnforceIf(g2)
            m.Add(hi_ <= i).OnlyEnforceIf(g2.Not())
            m.AddBoolAnd([g1, g2]).OnlyEnforceIf(inb)
            m.AddBoolOr([g1.Not(), g2.Not()]).OnlyEnforceIf(inb.Not())
            y = m.NewIntVar(0, 9, "")
            m.Add(y == X[c]).OnlyEnforceIf(inb)
            m.Add(y == 0).OnlyEnforceIf(inb.Not())
            ys.append(y)
        m.Add(sum(ys) == self.value)


class XSum(Outside):
    kind = "xsum"

    def prune(self, st):
        cells = self.cells
        S = self.value
        n = len(cells)
        sup = [0] * n
        any_ok = False
        for X0 in digs(st.cand[cells[0]]):
            rest = S - X0
            if X0 == 1:
                if rest != 0:
                    continue
                any_ok = True
                sup[0] |= bit(1)
                for i in range(1, n):
                    sup[i] |= st.cand[cells[i]] & ~bit(1)
                continue
            inner = list(range(1, X0))
            lists = [digs(st.cand[cells[i]] & ~bit(X0)) for i in inner]
            insup = [0] * len(inner)
            used_all = []

            def rec(j, s, used, vals):
                if s > rest:
                    return
                if j == len(inner):
                    if s == rest:
                        for t, v in enumerate(vals):
                            insup[t] |= bit(v)
                        used_all.append(used)
                    return
                for v in lists[j]:
                    if used & bit(v):
                        continue
                    vals.append(v)
                    rec(j + 1, s + v, used | bit(v), vals)
                    vals.pop()

            rec(0, 0, bit(X0), [])
            if not used_all:
                continue
            any_ok = True
            sup[0] |= bit(X0)
            for t, i in enumerate(inner):
                sup[i] |= insup[t]
            for i in range(X0, n):
                m_ = 0
                for u in used_all:
                    m_ |= st.cand[cells[i]] & ~u
                sup[i] |= m_
        if not any_ok:
            raise Contradiction("xsum impossible")
        return apply_support(st, cells, sup, f"x-sum {S} ({self.side[0]}{self.side[1]+1})")

    def ok(self, sol):
        v = [sol[c] for c in self.cells]
        return sum(v[: v[0]]) == self.value

    def cp(self, m, X, B):
        ys = []
        first = X[self.cells[0]]
        for i, c in enumerate(self.cells):
            inb = m.NewBoolVar("")
            m.Add(first > i).OnlyEnforceIf(inb)
            m.Add(first <= i).OnlyEnforceIf(inb.Not())
            y = m.NewIntVar(0, 9, "")
            m.Add(y == X[c]).OnlyEnforceIf(inb)
            m.Add(y == 0).OnlyEnforceIf(inb.Not())
            ys.append(y)
        m.Add(sum(ys) == self.value)


class Skyscraper(Outside):
    kind = "skyscraper"

    def prune(self, st):
        cells = self.cells
        K = self.value
        n = len(cells)

        def pok(v, i):
            seen = 0
            mx = 0
            for x in v[: i + 1]:
                if x > mx:
                    seen += 1
                    mx = x
            if seen > K:
                return False
            # maximum further visible: count of digits > mx not yet used, bounded by remaining cells
            used = set(v[: i + 1])
            higher = sum(1 for d in range(mx + 1, n + 1) if d not in used)
            return seen + min(higher, n - 1 - i) >= K

        def fok(v):
            seen = 0
            mx = 0
            for x in v:
                if x > mx:
                    seen += 1
                    mx = x
            return seen == K

        sup = enum_gac(st, cells, pok, fok, all_distinct=True, limit=200000)
        return apply_support(st, cells, sup, f"skyscraper {K} ({self.side[0]}{self.side[1]+1})")

    def ok(self, sol):
        seen = mx = 0
        for c in self.cells:
            if sol[c] > mx:
                seen += 1
                mx = sol[c]
        return seen == self.value

    def cp(self, m, X, B):
        prev = X[self.cells[0]]
        bs = []
        for c in self.cells[1:]:
            cur = m.NewIntVar(1, 9, "")
            m.AddMaxEquality(cur, [prev, X[c]])
            b = m.NewBoolVar("")
            m.Add(cur > prev).OnlyEnforceIf(b)
            m.Add(cur == prev).OnlyEnforceIf(b.Not())
            bs.append(b)
            prev = cur
        m.Add(1 + sum(bs) == self.value)


class Quad(Con):
    kind = "quad"

    def __init__(self, cells, digits):
        self.cells = list(cells)  # 4 cells around a corner
        self.digits = list(digits)

    def prune(self, st):
        need = self.digits

        def fok(v):
            pool = list(v)
            for d in need:
                if d in pool:
                    pool.remove(d)
                else:
                    return False
            return True

        sup = enum_gac(st, self.cells, None, fok)
        return apply_support(st, self.cells, sup, f"quadruple {need}")

    def ok(self, sol):
        pool = [sol[c] for c in self.cells]
        for d in self.digits:
            if d in pool:
                pool.remove(d)
            else:
                return False
        return True

    def cp(self, m, X, B):
        from collections import Counter
        for d, k in Counter(self.digits).items():
            m.Add(sum(B[c][d] for c in self.cells) >= k)

    def js(self):
        return {"type": "quad", "cells": cells_js(self.cells), "digits": self.digits}


class Parity1(Con):
    """single-cell even (square) / odd (circle) marker"""
    kind = "parity1"

    def __init__(self, cell, even):
        self.cells = [cell]
        self.even = even

    def prune(self, st):
        m = 0
        for d in range(1, st.geo.n + 1):
            if (d % 2 == 0) == self.even:
                m |= bit(d)
        return st.restrict(self.cells[0], m, f"{'even' if self.even else 'odd'} marker")

    def ok(self, sol):
        return (sol[self.cells[0]] % 2 == 0) == self.even

    def cp(self, m, X, B):
        t = m.NewIntVar(0, 9, "")
        m.Add(X[self.cells[0]] == 2 * t + (0 if self.even else 1))

    def js(self):
        return {"type": "even" if self.even else "odd", "cells": cells_js(self.cells)}


class Less(Con):
    """a < b (used to build terrain rules)."""
    kind = "less"

    def __init__(self, a, b, why="", tag=None):
        self.cells = [a, b]
        self.why = why
        self.tag = tag

    def prune(self, st):
        a, b = self.cells
        ch = st.restrict(b, ~((1 << lo(st.cand[a])) - 1) & st.geo.ALL, self.why)
        ch = st.restrict(a, (1 << (hi(st.cand[b]) - 1)) - 1, self.why) or ch
        return ch

    def ok(self, sol):
        return sol[self.cells[0]] < sol[self.cells[1]]

    def cp(self, m, X, B):
        m.Add(X[self.cells[0]] < X[self.cells[1]])

    def js(self):
        return None


class Group(Con):
    """A visible clue composed of sub-constraints (for terrain features)."""

    def __init__(self, kind, parts, data, cells):
        self.kind = kind
        self.parts = parts
        self.data = data
        self.cells = list(cells)

    def prune(self, st):
        ch = False
        for p in self.parts:
            ch = p.prune(st) or ch
        return ch

    def ok(self, sol):
        return all(p.ok(sol) for p in self.parts)

    def cp(self, m, X, B):
        for p in self.parts:
            p.cp(m, X, B)

    def js(self):
        d = dict(self.data)
        d["type"] = self.kind
        return d


class AllAbove(Con):
    """every cell of U greater than every cell of D (contour / basin)."""

    def __init__(self, U, D, why, h=None):
        self.U = list(U)
        self.D = list(D)
        self.cells = self.U + self.D
        self.why = why
        self.h = h

    def prune(self, st):
        ch = False
        A = st.geo.ALL
        if self.h is not None:
            for u in self.U:
                ch = st.restrict(u, A & ~((1 << self.h) - 1), self.why) or ch
            for d in self.D:
                ch = st.restrict(d, (1 << self.h) - 1, self.why) or ch
        # all u > all d
        mind = max(lo(st.cand[d]) for d in self.D)
        maxu = min(hi(st.cand[u]) for u in self.U)
        for u in self.U:
            ch = st.restrict(u, A & ~((1 << mind) - 1), self.why) or ch
        for d in self.D:
            ch = st.restrict(d, (1 << (maxu - 1)) - 1, self.why) or ch
        return ch

    def ok(self, sol):
        if self.h is not None:
            if any(sol[u] <= self.h for u in self.U) or any(sol[d] > self.h for d in self.D):
                return False
        return min(sol[u] for u in self.U) > max(sol[d] for d in self.D)

    def cp(self, m, X, B):
        if self.h is not None:
            for u in self.U:
                m.Add(X[u] > self.h)
            for d in self.D:
                m.Add(X[d] <= self.h)
        t = m.NewIntVar(1, 9, "")
        for u in self.U:
            m.Add(X[u] > t)
        for d in self.D:
            m.Add(X[d] <= t)


class Shadow(Con):
    """Sun low in the west at 45 degrees. lit=True: no cell k to the west has digit >= own+k."""

    def __init__(self, cell, lit, geo):
        self.cells = [cell]
        self.cell = cell
        self.lit = lit
        n = geo.n
        r, c = divmod(cell, n)
        self.west = [(r * n + (c - k), k) for k in range(1, c + 1)]
        self.kind = "sun" if lit else "shade"

    def prune(self, st):
        x = self.cell
        ch = False
        A = st.geo.ALL
        if self.lit:
            for w, k in self.west:
                # x_w <= x + k - 1
                ch = pair_ac(st, w, x, lambda a, b, k=k: a <= b + k - 1, f"sunlit {st.geo.name(x)}") or ch
            return ch
        # shaded: exists w with x_w >= x + k
        sup_x = 0
        casters = []
        for w, k in self.west:
            okv = 0
            for v in digs(st.cand[x]):
                if hi(st.cand[w]) >= v + k and not (st.geo.sees(w, x) and False):
                    okv |= bit(v)
            if okv:
                casters.append((w, k))
                sup_x |= okv
        if not casters:
            raise Contradiction("shade impossible")
        ch = st.restrict(x, sup_x, f"shaded {st.geo.name(x)}") or ch
        if len(casters) == 1:
            w, k = casters[0]
            ch = pair_ac(st, w, x, lambda a, b, k=k: a >= b + k, f"only {st.geo.name(w)} can shade {st.geo.name(x)}") or ch
        return ch

    def ok(self, sol):
        x = sol[self.cell]
        shaded = any(sol[w] >= x + k for w, k in self.west)
        return shaded != self.lit

    def cp(self, m, X, B):
        x = X[self.cell]
        if self.lit:
            for w, k in self.west:
                m.Add(X[w] <= x + k - 1)
        else:
            bs = []
            for w, k in self.west:
                b = m.NewBoolVar("")
                m.Add(X[w] >= x + k).OnlyEnforceIf(b)
                bs.append(b)
            m.AddBoolOr(bs)

    def js(self):
        return {"type": self.kind, "cells": cells_js([self.cell])}


# --------------------------------------------------------------------------- CP-SAT
def build_model(geo, cons, givens=None, domains=None):
    m = cp_model.CpModel()
    n = geo.n
    X = [m.NewIntVar(1, n, f"x{c}") for c in range(geo.NC)]
    B = [[None] + [m.NewBoolVar("") for d in range(1, n + 1)] for c in range(geo.NC)]
    for c in range(geo.NC):
        m.AddExactlyOne(B[c][1:])
        m.Add(X[c] == sum(d * B[c][d] for d in range(1, n + 1)))
    for h in geo.houses:
        if len(h) == n:
            for d in range(1, n + 1):
                m.AddExactlyOne([B[c][d] for c in h])
        else:
            m.AddAllDifferent([X[c] for c in h])
    if givens:
        for c, v in givens.items():
            m.Add(X[c] == v)
    if domains:
        for c, mask in domains.items():
            for d in range(1, n + 1):
                if not mask & bit(d):
                    m.Add(B[c][d] == 0)
    for con in cons:
        con.cp(m, X, B)
    return m, X, B


def solve_cp(geo, cons, givens=None, limit=2, time_limit=60, domains=None):
    """Return list of up to `limit` solutions (each a list of digits)."""
    m, X, B = build_model(geo, cons, givens, domains)
    sols = []
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 8
    while len(sols) < limit:
        st = solver.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break
        s = [solver.Value(X[c]) for c in range(geo.NC)]
        sols.append(s)
        m.AddBoolOr([B[c][s[c]].Not() for c in range(geo.NC)])
    return sols


def forced_cells(geo, cons, givens=None, ref=None, time_limit=60, domains=None):
    """Cells whose value is the same in every solution (requires at least one solution)."""
    m, X, B = build_model(geo, cons, givens, domains)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 8
    if ref is None:
        st = solver.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return None
        ref = [solver.Value(X[c]) for c in range(geo.NC)]
    U = set(range(geo.NC))
    while True:
        mm = m.Clone() if hasattr(m, "Clone") else None
        if mm is None:
            m2, X2, B2 = build_model(geo, cons, givens, domains)
        else:
            m2, X2, B2 = mm, X, B
        m2.AddBoolOr([B2[c][ref[c]].Not() for c in U])
        st = solver.Solve(m2)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {c: ref[c] for c in U}
        s = [solver.Value(X2[c]) for c in range(geo.NC)]
        U = {c for c in U if s[c] == ref[c]}


# --------------------------------------------------------------------------- helpers
def show(cand_or_vals, n=9, is_cand=True):
    rows = []
    for r in range(n):
        row = []
        for c in range(n):
            x = cand_or_vals[r * n + c]
            if is_cand:
                row.append(str(lo(x)) if pc(x) == 1 else ".")
            else:
                row.append(str(x) if x else ".")
            if c % 3 == 2 and c < n - 1:
                row.append("|")
        rows.append(" ".join(row))
        if r % 3 == 2 and r < n - 1:
            rows.append("-" * len(rows[-1]))
    return "\n".join(rows)


def show_cands(cand, n=9):
    w = 9
    lines = []
    for r in range(n):
        parts = []
        for c in range(n):
            s = "".join(str(d) for d in digs(cand[r * n + c]))
            parts.append(s.ljust(w))
            if c % 3 == 2 and c < n - 1:
                parts.append("|")
        lines.append(" ".join(parts))
        if r % 3 == 2 and r < n - 1:
            lines.append("-" * len(lines[-1]))
    return "\n".join(lines)


def random_solution(geo, seed=None, fixed=None, cons=()):
    """random full grid (optionally with fixed cells / constraints) via CP-SAT with random hints."""
    rnd = random.Random(seed)
    m, X, B = build_model(geo, cons, fixed)
    # random objective to diversify
    weights = [rnd.randint(-50, 50) for _ in range(geo.NC * geo.n)]
    obj = []
    k = 0
    for c in range(geo.NC):
        for d in range(1, geo.n + 1):
            obj.append(weights[k] * B[c][d])
            k += 1
    m.Maximize(sum(obj))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    solver.parameters.num_workers = 8
    solver.parameters.random_seed = rnd.randint(0, 10000)
    st = solver.Solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return [solver.Value(X[c]) for c in range(geo.NC)]


def logic_solve(geo, cons, givens, max_tier=3, use_subsets=True, cand=None):
    st = State(geo, cons, givens, cand=cand)
    try:
        st.propagate(max_tier=max_tier, use_subsets=use_subsets)
    except Contradiction as e:
        return st, str(e)
    return st, None


def check_solution(geo, cons, sol):
    for h in geo.houses:
        if len(h) == geo.n and sorted(sol[c] for c in h) != list(range(1, geo.n + 1)):
            return False, "house"
    for con in cons:
        if not con.ok(sol):
            return False, con.kind
    return True, None
