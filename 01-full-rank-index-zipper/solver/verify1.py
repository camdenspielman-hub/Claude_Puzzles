import sys
from ortools.sat.python import cp_model
import model as M
skip = tuple(sys.argv[1].split(","))
facts = [x.split("=") for x in sys.argv[2].split()]
for cell, val in facts:
    def extra(m, g, ext, cell=cell, val=val):
        if cell.startswith("r"):
            r, c = int(cell[1]), int(cell[3]); m.Add(g[r, c] != int(val))
        else:
            m.Add(ext[cell] != int(val))
    mm, g, rank, RD, ext = M.build(extra=extra, skip=skip)
    s = cp_model.CpSolver(); s.parameters.num_workers = 4; s.parameters.max_time_in_seconds = 300
    st = s.Solve(mm)
    print(f"{cell}={val}: negation {s.StatusName(st)}  ({s.WallTime():.1f}s)", flush=True)
