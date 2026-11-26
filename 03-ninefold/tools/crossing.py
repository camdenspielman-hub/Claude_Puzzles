def diag_steps(cells, n=9):
    out = []
    for a, b in zip(cells, cells[1:]):
        ra, ca = divmod(a, n); rb, cb = divmod(b, n)
        if abs(ra-rb) == 1 and abs(ca-cb) == 1:
            out.append((a, b))
    return out

def crosses(d1, d2, n=9):
    (a, b), (c, d) = d1, d2
    ra, ca = divmod(a, n); rb, cb = divmod(b, n)
    rc_, cc = divmod(c, n); rd, cd = divmod(d, n)
    box1 = (min(ra, rb), min(ca, cb)); box2 = (min(rc_, rd), min(cc, cd))
    if box1 != box2: return False
    return {a, b} != {c, d}

def self_crossing(cells, n=9):
    ds = diag_steps(cells, n)
    return any(crosses(ds[i], ds[j], n) for i in range(len(ds)) for j in range(i+1, len(ds)))

def lines_cross(c1, c2, n=9):
    return any(crosses(x, y, n) for x in diag_steps(c1, n) for y in diag_steps(c2, n))
