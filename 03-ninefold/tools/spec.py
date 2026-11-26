"""Compact text spec for clue sets.

Lines:
  cage 17: r1c2 r1c3
  thermo: r8c9 r7c8 r8c7
  arrow: r1c4 | r2c3 r3c2          (circle | shaft)
  X: r1c1 r1c2      V: ...   white: ...   black: ...
  whisper: ...  dutch: ...  renban: ...  palindrome: ...  regionsum: ...
  between: ...  entropic: ...  modular: ...  parity: ...  zipper: ...  nabner: ...
  even: r1c1 r2c2     odd: ...
  quad 1 2: r1c1      (top-left cell of the 2x2)
  sandwich L1 13 / xsum T3 25 / sky R4 3      (side + 1-based index)
  lk 15: r1c3 dr dc   (little killer: first cell, direction e.g. 1 1)
  given: r1c1=5 r2c2=3
  peak: r1c1   hollow: r2c2
  river: r1c1 r1c2 r1c3 ...
  lake: r1c1 r1c2
  contour [h]: up r1c1 r1c2 | down r2c1 r2c2
  sun: r1c5   shade: r2c6
"""
from nf import *


def side_cells(side, idx, n=9):
    if side == "L":
        return [idx * n + c for c in range(n)]
    if side == "R":
        return [idx * n + c for c in range(n - 1, -1, -1)]
    if side == "T":
        return [r * n + idx for r in range(n)]
    if side == "B":
        return [r * n + idx for r in range(n - 1, -1, -1)]


def lk_cells(first, dr, dc, n=9):
    r, c = divmod(first, n)
    out = []
    while 0 <= r < n and 0 <= c < n:
        out.append(r * n + c)
        r += dr
        c += dc
    return out


def terrain_river(geo, cells):
    parts = []
    for i in range(len(cells) - 1):
        a, b = cells[i], cells[i + 1]
        parts.append(Less(b, a, "river flows downhill"))
        for o in geo.nbrs(a):
            if o != b:
                parts.append(Less(b, o, "river takes the lowest neighbour"))
    return Group("river", parts, {"cells": cells_js(cells)}, cells)


def terrain_peak(geo, cell, peak=True):
    parts = []
    for o in geo.nbrs(cell):
        parts.append(Less(o, cell, "peak") if peak else Less(cell, o, "hollow"))
    return Group("peak" if peak else "hollow", parts, {"cells": cells_js([cell])}, [cell])


def terrain_lake(geo, cells):
    cs = set(cells)
    shore = sorted({o for c in cells for o in geo.nbrs(c) if o not in cs})
    aa = AllAbove(shore, cells, "lake lies below its shore")
    return Group("lake", [aa], {"cells": cells_js(cells)}, list(cells))


def parse(text, geo, n=9):
    cons = []
    givens = {}
    for raw in text.strip().splitlines():
        line = raw.split("#")[0].strip()
        if not line:
            continue
        head, _, body = line.partition(":")
        hp = head.split()
        kind = hp[0]
        if kind == "given":
            for tok in body.split():
                cell, v = tok.split("=")
                givens[parse_cells(cell, n)[0]] = int(v)
            continue
        if kind == "cage":
            cons.append(Killer(parse_cells(body, n), int(hp[1])))
        elif kind == "thermo":
            cons.append(Thermo(parse_cells(body, n)))
        elif kind == "arrow":
            circ, shaft = body.split("|")
            cons.append(Arrow(parse_cells(circ, n)[0], parse_cells(shaft, n)))
        elif kind in ("X", "V", "white", "black"):
            a, b = parse_cells(body, n)
            cons.append(Pair(a, b, kind))
        elif kind == "whisper":
            cons.append(Whisper(parse_cells(body, n)))
        elif kind == "dutch":
            cons.append(Whisper(parse_cells(body, n), 4))
        elif kind == "renban":
            cons.append(Renban(parse_cells(body, n)))
        elif kind == "nabner":
            cons.append(Nabner(parse_cells(body, n)))
        elif kind == "palindrome":
            cons.append(Palindrome(parse_cells(body, n)))
        elif kind == "regionsum":
            cons.append(RegionSum(parse_cells(body, n), geo))
        elif kind == "between":
            cons.append(Between(parse_cells(body, n)))
        elif kind == "entropic":
            cons.append(Entropic(parse_cells(body, n)))
        elif kind == "modular":
            cons.append(Modular(parse_cells(body, n)))
        elif kind == "parity":
            cons.append(Parity(parse_cells(body, n)))
        elif kind == "zipper":
            cons.append(Zipper(parse_cells(body, n)))
        elif kind in ("even", "odd"):
            for c in parse_cells(body, n):
                cons.append(Parity1(c, kind == "even"))
        elif kind == "quad":
            tl = parse_cells(body, n)[0]
            cells = [tl, tl + 1, tl + n, tl + n + 1]
            cons.append(Quad(cells, [int(x) for x in hp[1:]]))
        elif kind in ("sandwich", "xsum", "sky"):
            side = hp[1][0]
            idx = int(hp[1][1:]) - 1
            val = int(hp[2])
            cells = side_cells(side, idx, n)
            cls = {"sandwich": Sandwich, "xsum": XSum, "sky": Skyscraper}[kind]
            cons.append(cls(cells, val, (side, idx)))
        elif kind == "lk":
            toks = body.split()
            first = parse_cells(toks[0], n)[0]
            dr, dc = int(toks[1]), int(toks[2])
            cells = lk_cells(first, dr, dc, n)
            r, c = divmod(first, n)
            cons.append(LittleKiller(cells, int(hp[1]), (r - dr, c - dc), (dr, dc)))
        elif kind in ("peak", "hollow"):
            for c in parse_cells(body, n):
                cons.append(terrain_peak(geo, c, kind == "peak"))
        elif kind == "river":
            cons.append(terrain_river(geo, parse_cells(body, n)))
        elif kind == "lake":
            cons.append(terrain_lake(geo, parse_cells(body, n)))
        elif kind == "contour":
            h = int(hp[1]) if len(hp) > 1 else None
            up, down = body.split("|")
            U = parse_cells(up.replace("up", ""), n)
            D = parse_cells(down.replace("down", ""), n)
            aa = AllAbove(U, D, "contour", h)
            cons.append(Group("contour", [aa], {"up": cells_js(U), "down": cells_js(D), "h": h}, U + D))
        elif kind in ("sun", "shade"):
            for c in parse_cells(body, n):
                cons.append(Shadow(c, kind == "sun", geo))
        else:
            raise ValueError("unknown clue " + kind)
    return cons, givens


def evaluate(geo, stages, base_givens, sol=None, kw=None, verbose=True, show_final=True):
    """stages: list of (name, text). Prints cumulative progress per stage."""
    kw = kw or {}
    cons = []
    givens = dict(base_givens)
    out = []
    for name, text in stages:
        c2, g2 = parse(text, geo)
        cons += c2
        givens.update(g2)
        if sol:
            for con in c2:
                if not con.ok(sol):
                    print("!! clue violates solution:", name, con.kind, [geo.name(x) for x in con.cells])
            for c, v in g2.items():
                if sol[c] != v:
                    print("!! given wrong", geo.name(c))
        st = State(geo, cons, givens, log=True)
        err = None
        try:
            st.propagate(**kw)
        except Contradiction as e:
            err = str(e)
        nsolved = sum(1 for c in range(geo.NC) if pc(st.cand[c]) == 1)
        out.append((name, nsolved, st, err))
        if verbose:
            print(f"== {name}: solved {nsolved}" + (f"  ERROR {err}" if err else ""))
    if verbose and show_final:
        print(show_cands(out[-1][2].cand))
    return out, cons, givens
