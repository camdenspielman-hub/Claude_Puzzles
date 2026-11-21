import sys, model as M
fam = sys.argv[1]
n, st, sols = M.count(skip=(fam,), cap=3, t=300)
print(fam, "->", n, "solutions", st)
