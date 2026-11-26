"""Act IV terrain clue pools from a solution."""
from nf import *
from spec import terrain_river, terrain_peak, terrain_lake
import itertools

def nb4(c, n=9):
    r, k = divmod(c, n)
    for dr, dc in ((-1,0),(1,0),(0,-1),(0,1)):
        rr, cc = r+dr, k+dc
        if 0 <= rr < n and 0 <= cc < n:
            yield rr*n+cc

def on_edge(c, n=9):
    r, k = divmod(c, n)
    return r in (0, n-1) or k in (0, n-1)

def steepest(sol, c):
    """next cell by steepest descent, or None if c is a local minimum"""
    ns = list(nb4(c))
    m = min(ns, key=lambda x: sol[x])
    if sol[m] >= sol[c]:
        return None
    if sum(1 for x in ns if sol[x] == sol[m]) > 1:
        return None  # tie: ambiguous
    return m

def rivers(sol, minlen=3):
    out = []
    for s in range(81):
        if on_edge(s):
            continue
        path = [s]
        cur = s
        ok = True
        while True:
            nx = steepest(sol, cur)
            if nx is None:
                ok = False; break
            path.append(nx)
            if on_edge(nx):
                break
            cur = nx
        if ok and len(path) >= minlen:
            out.append(path)
    return out

def peaks(sol):
    return [c for c in range(81) if all(sol[o] < sol[c] for o in nb4(c))]

def hollows(sol):
    return [c for c in range(81) if all(sol[o] > sol[c] for o in nb4(c))]

def lakes(sol, maxsize=3):
    out = []
    from design import polyominoes
    for s in polyominoes(maxsize):
        if len(s) < 2: continue
        cs = set(s)
        shore = {o for c in s for o in nb4(c) if o not in cs}
        if max(sol[c] for c in s) < min(sol[o] for o in shore):
            out.append(sorted(s))
    return out

def contours(sol, maxsize=5):
    """closed contours around small hills: component U (connected) with all U > all neighbours D."""
    from design import polyominoes
    out = []
    for s in polyominoes(maxsize):
        cs = set(s)
        D = sorted({o for c in s for o in nb4(c) if o not in cs})
        if min(sol[c] for c in s) > max(sol[o] for o in D):
            lo_, hi_ = max(sol[o] for o in D), min(sol[c] for c in s)
            out.append((sorted(s), D, lo_, hi_))
    return out

def open_contours(sol, length_min=3, length_max=6):
    """open contour chains: a straight/bent run of edges where uphill side > downhill side"""
    out = []
    n = 9
    # horizontal runs: between row r (up/down) and row r+1
    for r in range(n-1):
        for c0 in range(n):
            for L in range(length_min, length_max+1):
                if c0+L > n: break
                top = [r*n+c for c in range(c0, c0+L)]
                bot = [(r+1)*n+c for c in range(c0, c0+L)]
                if min(sol[x] for x in top) > max(sol[x] for x in bot):
                    out.append((top, bot))
                if min(sol[x] for x in bot) > max(sol[x] for x in top):
                    out.append((bot, top))
    for c in range(n-1):
        for r0 in range(n):
            for L in range(length_min, length_max+1):
                if r0+L > n: break
                left = [r*n+c for r in range(r0, r0+L)]
                right = [r*n+c+1 for r in range(r0, r0+L)]
                if min(sol[x] for x in left) > max(sol[x] for x in right):
                    out.append((left, right))
                if min(sol[x] for x in right) > max(sol[x] for x in left):
                    out.append((right, left))
    return out

def shade_state(sol, c):
    r, k = divmod(c, 9)
    x = sol[c]
    return any(sol[r*9 + (k-d)] >= x + d for d in range(1, k+1))
