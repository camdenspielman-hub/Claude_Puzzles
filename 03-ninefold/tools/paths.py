"""
Line-drawing panels (Act V).

Lattice: R x C cells, nodes (R+1) x (C+1), node id = y*(C+1)+x.
A path goes from a start node to an end node along lattice edges without revisiting nodes.
The path (plus the panel border) cuts the cells into regions.

Rules supported (each optional):
  sums      : {cell: digit}; every region's digits must sum to `target`
  distinct  : every region has no repeated digit
  complete  : every region holds digits 1..k exactly once (k = number of digit cells in region)
  dots      : nodes the path must visit
  edots     : edges (node pair) the path must use
  colors    : {cell: color}; a region may not hold two different colors
  counts    : {cell: k}; exactly k of the cell's four edges are on the path
  sizes     : every region must have exactly `size` cells
"""
import sys
sys.setrecursionlimit(10000)


class Panel:
    def __init__(self, R, C, start, end, sums=None, target=None, distinct=False, complete=False,
                 dots=(), edots=(), colors=None, counts=None, size=None, starts=None, ends=None, gaps=()):
        self.R, self.C = R, C
        self.W = C + 1
        self.starts = list(starts) if starts else [start]
        self.ends = set(ends) if ends else {end}
        self.sums = sums or {}
        self.target = target
        self.distinct = distinct
        self.complete = complete
        self.dots = set(dots)
        self.edots = {frozenset(e) for e in edots}
        self.colors = colors or {}
        self.counts = counts or {}
        self.size = size
        self.gaps = {frozenset(e) for e in gaps}
        # node adjacency
        self.adj = {}
        for y in range(R + 1):
            for x in range(C + 1):
                n = y * self.W + x
                a = []
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx <= C and 0 <= yy <= R:
                        m = yy * self.W + xx
                        if frozenset((n, m)) not in self.gaps:
                            a.append(m)
                self.adj[n] = a
        # for each lattice edge, the cells on either side (None if outside)
        self.edge_cells = {}
        for y in range(R + 1):
            for x in range(C + 1):
                n = y * self.W + x
                if x < C:  # horizontal edge to the right: separates cell above (y-1,x) and below (y,x)
                    m = n + 1
                    above = (y - 1) * C + x if y > 0 else None
                    below = y * C + x if y < R else None
                    self.edge_cells[frozenset((n, m))] = (above, below)
                if y < R:  # vertical edge down: separates cell left (y,x-1) and right (y,x)
                    m = n + self.W
                    left = y * C + x - 1 if x > 0 else None
                    right = y * C + x if x < C else None
                    self.edge_cells[frozenset((n, m))] = (left, right)
        # cell adjacency through each internal edge
        self.cell_edges = {c: [] for c in range(R * C)}
        for e, (a, b) in self.edge_cells.items():
            if a is not None:
                self.cell_edges[a].append(e)
            if b is not None:
                self.cell_edges[b].append(e)

    def node(self, x, y):
        return y * self.W + x

    def regions(self, used):
        R, C = self.R, self.C
        seen = [-1] * (R * C)
        regs = []
        for s in range(R * C):
            if seen[s] >= 0:
                continue
            stack = [s]
            seen[s] = len(regs)
            reg = []
            while stack:
                c = stack.pop()
                reg.append(c)
                for e in self.cell_edges[c]:
                    if e in used:
                        continue
                    a, b = self.edge_cells[e]
                    o = b if a == c else a
                    if o is not None and seen[o] < 0:
                        seen[o] = len(regs)
                        stack.append(o)
            regs.append(reg)
        return regs

    def region_ok(self, reg):
        if self.size is not None and len(reg) != self.size:
            return False
        ds = [self.sums[c] for c in reg if c in self.sums]
        if self.target is not None and ds and sum(ds) != self.target:
            return False
        if self.distinct and len(set(ds)) != len(ds):
            return False
        if self.complete and sorted(ds) != list(range(1, len(ds) + 1)):
            return False
        cols = {self.colors[c] for c in reg if c in self.colors}
        if len(cols) > 1:
            return False
        return True

    def check(self, path):
        used = {frozenset((path[i], path[i + 1])) for i in range(len(path) - 1)}
        if not self.dots <= set(path):
            return False
        if not self.edots <= used:
            return False
        for c, k in self.counts.items():
            if sum(1 for e in self.cell_edges[c] if e in used) != k:
                return False
        for reg in self.regions(used):
            if not self.region_ok(reg):
                return False
        return True

    def partial_ok(self, path, used, visited):
        """prune: regions that can no longer change must already be valid"""
        head = path[-1]
        # nodes reachable from head through unvisited nodes
        reach = {head}
        stack = [head]
        while stack:
            n = stack.pop()
            for m in self.adj[n]:
                if m not in reach and m not in visited:
                    reach.add(m)
                    stack.append(m)
        # every remaining dot must be reachable
        for d in self.dots:
            if d not in visited and d not in reach:
                return False
        if not (self.ends & reach):
            return False
        # count clues: cells whose edges are all frozen must match; never exceed
        for c, k in self.counts.items():
            have = 0
            free = 0
            for e in self.cell_edges[c]:
                if e in used:
                    have += 1
                else:
                    a, b = tuple(e)
                    if a in reach and b in reach:
                        free += 1
            if have > k or have + free < k:
                return False
        if not (self.target is not None or self.distinct or self.complete or self.colors or self.size):
            return True
        regs = self.regions(used)
        for reg in regs:
            live = False
            for c in reg:
                for e in self.cell_edges[c]:
                    if e in used:
                        continue
                    a, b = tuple(e)
                    if a in reach and b in reach:
                        live = True
                        break
                if live:
                    break
            if not live and not self.region_ok(reg):
                return False
            if live:
                # live regions can still be split: only monotone checks
                if self.size is not None and len(reg) < self.size:
                    return False
                if self.target is not None:
                    s = sum(self.sums.get(c, 0) for c in reg)
                    if s < self.target and any(c in self.sums for c in reg):
                        # a live region with some digits may still lose cells, but its digit sum can only drop
                        return False
        return True

    def solve(self, limit=2, prune_every=1):
        sols = []
        for st in self.starts:
            path = [st]
            visited = {st}
            used = set()

            def rec():
                if len(sols) >= limit:
                    return
                head = path[-1]
                if head in self.ends and len(path) > 1:
                    if self.check(path):
                        sols.append(list(path))
                    # a path may not continue through an end node (ends are on the border nubs)
                    return
                for m in self.adj[head]:
                    if m in visited:
                        continue
                    e = frozenset((head, m))
                    path.append(m)
                    visited.add(m)
                    used.add(e)
                    if len(path) % prune_every != 0 or self.partial_ok(path, used, visited):
                        rec()
                    path.pop()
                    visited.discard(m)
                    used.discard(e)

            rec()
        return sols


def draw(panel, path=None):
    """ASCII render: nodes '+', path edges '#', cells show digit/color."""
    R, C, W = panel.R, panel.C, panel.W
    used = set()
    if path:
        used = {frozenset((path[i], path[i + 1])) for i in range(len(path) - 1)}
    lines = []
    for y in range(R + 1):
        s = ""
        for x in range(C + 1):
            n = y * W + x
            ch = "+"
            if n in panel.starts:
                ch = "O"
            elif n in panel.ends:
                ch = "E"
            elif n in panel.dots:
                ch = "*"
            s += ch
            if x < C:
                s += "###" if frozenset((n, n + 1)) in used else "---"
        lines.append(s)
        if y < R:
            s = ""
            for x in range(C + 1):
                n = y * W + x
                s += "#" if frozenset((n, n + W)) in used else "|"
                if x < C:
                    c = y * C + x
                    v = panel.sums.get(c, panel.colors.get(c, panel.counts.get(c, " ")))
                    s += f" {v} "
            lines.append(s)
    return "\n".join(lines)
