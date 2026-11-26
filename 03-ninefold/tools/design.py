"""Helpers to generate candidate clues from a known solution and greedily build stages."""
from nf import *
import random

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def nb(cell, dirs, n=9):
    r, c = divmod(cell, n)
    for dr, dc in dirs:
        rr, cc = r + dr, c + dc
        if 0 <= rr < n and 0 <= cc < n:
            yield rr * n + cc


_POLY_CACHE = {}
def polyominoes(maxsize, n=9):
    key = (maxsize, n)
    if key not in _POLY_CACHE:
        _POLY_CACHE[key] = _polyominoes(maxsize, n)
    return _POLY_CACHE[key]

def _polyominoes(maxsize, n=9):
    """all connected cell sets (fixed placements) up to maxsize"""
    seen = set()
    frontier = [frozenset([c]) for c in range(n * n)]
    out = []
    for size in range(2, maxsize + 1):
        nxt = set()
        for s in frontier:
            for c in s:
                for d in nb(c, N4, n):
                    if d not in s:
                        t = s | {d}
                        if t not in nxt:
                            nxt.add(t)
        frontier = list(nxt)
        out.extend(frontier)
    return out


def cage_pool(sol, sizes=(2, 3, 4, 5)):
    out = []
    for s in polyominoes(max(sizes)):
        if len(s) not in sizes:
            continue
        vals = [sol[c] for c in s]
        if len(set(vals)) != len(vals):
            continue
        out.append(Killer(sorted(s), sum(vals)))
    return out


def paths(sol, minlen, maxlen, dirs, pred_step, n=9):
    """simple paths where pred_step(prev_vals, nextval) holds"""
    res = []

    def rec(path, vals):
        if len(path) >= minlen:
            res.append(list(path))
        if len(path) == maxlen:
            return
        for d in nb(path[-1], dirs, n):
            if d in path:
                continue
            if pred_step(vals, sol[d]):
                path.append(d)
                vals.append(sol[d])
                rec(path, vals)
                path.pop()
                vals.pop()

    for c in range(n * n):
        rec([c], [sol[c]])
    return res


def thermo_pool(sol, minlen=3, maxlen=6, diag=True):
    ps = paths(sol, minlen, maxlen, N8 if diag else N4, lambda v, x: x > v[-1])
    return [Thermo(p) for p in ps]


def arrow_pool(sol, maxshaft=3, diag=True):
    out = []
    for c in range(81):
        target = sol[c]
        for s in nb(c, N8 if diag else N4):
            def rec(path, total):
                if total == target:
                    out.append(Arrow(c, list(path)))
                if total >= target or len(path) == maxshaft:
                    return
                for d in nb(path[-1], N8 if diag else N4):
                    if d in path or d == c:
                        continue
                    path.append(d)
                    rec(path, total + sol[d])
                    path.pop()
            rec([s], sol[s])
    return out


def pair_pool(sol, kinds=("X", "V", "white", "black")):
    out = []
    for a in range(81):
        for b in nb(a, [(0, 1), (1, 0)]):
            x, y = sol[a], sol[b]
            if "X" in kinds and x + y == 10:
                out.append(Pair(a, b, "X"))
            if "V" in kinds and x + y == 5:
                out.append(Pair(a, b, "V"))
            if "white" in kinds and abs(x - y) == 1 and not (x * 2 == y or y * 2 == x and "black" in kinds and False):
                out.append(Pair(a, b, "white"))
            if "black" in kinds and (x == 2 * y or y == 2 * x):
                out.append(Pair(a, b, "black"))
    return out


def solved_count(geo, cons, givens, **kw):
    try:
        st = State(geo, cons, givens, log=False)
        st.propagate(**kw)
    except Contradiction:
        return -1, None
    return sum(1 for c in range(geo.NC) if pc(st.cand[c]) == 1), st


def greedy_stage(geo, base_cons, givens, pool, max_add, target, rnd, sample=60,
                 accept=None, used_cells=None, topk=3, kw=None):
    kw = kw or {}
    cons = list(base_cons)
    n0, st0 = solved_count(geo, cons, givens, **kw)
    added = []
    used = set(used_cells or ())
    for _ in range(max_add):
        cur, st = solved_count(geo, cons, givens, **kw)
        if cur >= target:
            break
        solved_cells = {c for c in range(geo.NC) if pc(st.cand[c]) == 1}
        cands = [p for p in pool if not (set(p.cells) & used) and (accept is None or accept(p, solved_cells, cons))]
        if not cands:
            break
        smp = rnd.sample(cands, min(sample, len(cands)))
        scored = []
        for p in smp:
            k, _ = solved_count(geo, cons + [p], givens, **kw)
            scored.append((k, rnd.random(), p))
        scored.sort(key=lambda x: (-x[0], x[1]))
        best = scored[: topk]
        if best[0][0] <= cur:
            # nothing helps: still add the clue that removes most candidates
            pass
        k, _, p = rnd.choice(best)
        cons.append(p)
        added.append(p)
        used |= set(p.cells)
    return cons, added


def minimize(geo, cons, givens, removable, kw=None):
    kw = kw or {}
    target, _ = solved_count(geo, cons, givens, **kw)
    cons = list(cons)
    for p in list(removable):
        trial = [c for c in cons if c is not p]
        k, _ = solved_count(geo, trial, givens, **kw)
        if k >= target:
            cons = trial
    return cons


def capped_stage(geo, base_cons, givens, pool, nclues, lo_t, hi_t, rnd, sample=150,
                 accept=None, kw=None, tries=30):
    """Add exactly `nclues` clues (if possible) so that final solved count lands in [lo_t, hi_t],
    spreading progress across clues. Returns (cons, added) or None."""
    kw = kw or {}
    for attempt in range(tries):
        cons = list(base_cons)
        added = []
        used = set()
        ok = True
        for i in range(nclues):
            cur, st = solved_count(geo, cons, givens, **kw)
            solved_cells = {c for c in range(geo.NC) if pc(st.cand[c]) == 1}
            remaining = nclues - i
            step_hi = cur + max(1, (hi_t - cur) // remaining + 3)
            if i == nclues - 1:
                step_lo, step_hi = lo_t, hi_t
            else:
                step_lo = cur
            cands = [p for p in pool if not (set(p.cells) & used)
                     and (accept is None or accept(p, solved_cells, cons))]
            smp = rnd.sample(cands, min(sample, len(cands)))
            good = []
            for p in smp:
                k, _ = solved_count(geo, cons + [p], givens, **kw)
                if step_lo <= k <= step_hi and k >= 0:
                    good.append((k, p))
            if not good:
                ok = False
                break
            # prefer some progress but not max
            good.sort(key=lambda x: x[0])
            k, p = rnd.choice(good[len(good) // 2:]) if i < nclues - 1 else max(good, key=lambda x: x[0])
            cons.append(p)
            added.append(p)
            used |= set(p.cells)
        if ok:
            k, _ = solved_count(geo, cons, givens, **kw)
            if lo_t <= k <= hi_t:
                # every clue must matter
                essential = all(solved_count(geo, [c for c in cons if c is not a], givens, **kw)[0] < k for a in added)
                if essential:
                    return cons, added
    return None


# ---------------------------------------------------------------- line pools (Act II)
def line_paths(sol, minlen, maxlen, diag=True, n=9, step_ok=None):
    return paths(sol, minlen, maxlen, N8 if diag else N4, step_ok or (lambda v, x: True), n)


def _ok_full(cls_obj, sol):
    try:
        return cls_obj.ok(sol)
    except Exception:
        return False


def make_line_pool(geo, sol, kind, minlen=3, maxlen=7, diag=True, limit=None):
    from nf import Whisper, Renban, Palindrome, RegionSum, Between, Entropic, Modular, Zipper, Parity, Nabner
    step = None
    if kind == "whisper":
        step = lambda v, x: abs(x - v[-1]) >= 5
    elif kind == "dutch":
        step = lambda v, x: abs(x - v[-1]) >= 4
    elif kind == "parity":
        step = lambda v, x: (x + v[-1]) % 2 == 1
    elif kind == "renban":
        step = lambda v, x: x not in v and max(v + [x]) - min(v + [x]) <= maxlen - 1
    elif kind == "nabner":
        step = lambda v, x: all(abs(x - y) > 1 for y in v)
    elif kind == "entropic":
        step = lambda v, x: ((x - 1) // 3) != ((v[-1] - 1) // 3) and (len(v) < 2 or ((x - 1) // 3) != ((v[-2] - 1) // 3))
    elif kind == "modular":
        step = lambda v, x: (x % 3) != (v[-1] % 3) and (len(v) < 2 or (x % 3) != (v[-2] % 3))
    ps = paths(sol, minlen, maxlen, N8 if diag else N4, step or (lambda v, x: True))
    out = []
    seen = set()
    for p in ps:
        key = tuple(p) if p[0] < p[-1] else tuple(reversed(p))
        if key in seen:
            continue
        seen.add(key)
        if kind == "whisper":
            o = Whisper(p)
        elif kind == "dutch":
            o = Whisper(p, 4)
        elif kind == "renban":
            vals = [sol[c] for c in p]
            if max(vals) - min(vals) != len(p) - 1:
                continue
            o = Renban(p)
        elif kind == "nabner":
            o = Nabner(p)
        elif kind == "palindrome":
            o = Palindrome(p)
        elif kind == "regionsum":
            o = RegionSum(p, geo)
            if len(o.segs) < 2:
                continue
        elif kind == "between":
            o = Between(p)
        elif kind == "entropic":
            o = Entropic(p)
        elif kind == "modular":
            o = Modular(p)
        elif kind == "zipper":
            o = Zipper(p)
        elif kind == "parity":
            o = Parity(p)
        else:
            raise ValueError(kind)
        if o.ok(sol):
            out.append(o)
    return out
