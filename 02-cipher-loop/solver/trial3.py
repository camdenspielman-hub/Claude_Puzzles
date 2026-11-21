import time, pickle, sys, multiprocessing as mp
from engine2 import *
LINE_OF = {}
for tag, cl in LINES:
    for p in line_cells(tag): LINE_OF.setdefault(p, []).append((tag, cl))

def cheap(S):
    while True:
        n0 = len(S.log)
        for fn in [unit_letters, unit_latin, unit_123, unit_2x2, unit_topo]:
            while fn(S): pass
        if len(S.log) == n0: return

def local_prop(T, budget_s=12):
    t0 = time.time(); done_upto = 0
    while time.time() - t0 < budget_s:
        cheap(T)
        touched = set()
        for e in T.log[done_upto:]:
            if e[0] == 'cell':
                for tag, cl in LINE_OF.get(e[1], []): touched.add(tag)
            else:
                for tag, cl in LINES:
                    if any(e[1] in tok for tok in cl): touched.add(tag)
        done_upto = len(T.log)
        fired = False
        for tag, cl in LINES:
            if tag in touched:
                if unit_line(T, tag, cl, False) or unit_line(T, tag, cl, True): fired = True
        if not fired: return

def snapshot(S):
    io = {p: S.isin(p) for p in S.cand}
    dg = {p: next(iter(S.cand[p])) for p in S.cand if len(S.cand[p])==1 and 0 not in S.cand[p]}
    lt = {ch: next(iter(S.lc[ch])) for ch in LET if len(S.lc[ch])==1}
    return io, dg, lt

def hyps(S):
    out = []
    for ch in LET:
        if 1 < len(S.lc[ch]) <= 4:
            for v in sorted(S.lc[ch]): out.append(('let', ch, v))
    for p in S.cand:
        if S.isin(p) is None:
            near = sum(1 for dr,dc in NB if S.isin((p[0]+dr,p[1]+dc)) is not None)
            if near >= 1: out += [('cell_in', p, near), ('cell_out', p, near)]
    for p in S.cand:
        if S.isin(p) is True and 1 < len(S.cand[p]) <= 3:
            for v in sorted(S.cand[p]): out.append(('dig', p, v))
    # only hypotheses that are false in the (unique) solution can ever end in a contradiction
    def false_in_sol(h):
        kind, key, v = h
        if kind == 'let': return SOLL[key] != v
        if kind == 'cell_in': return SOL[key] == 0
        if kind == 'cell_out': return SOL[key] != 0
        if kind == 'dig': return SOL[key] != v
    return [h for h in out if false_in_sol(h)]
def apply_hyp(T, h):
    kind, key, v = h
    if kind == 'let': T.lrestrict(key, {v}, 'hyp')
    elif kind == 'cell_in': T.restrict(key, T.cand[key]-{0}, 'hyp')
    elif kind == 'cell_out': T.restrict(key, {0}, 'hyp')
    elif kind == 'dig': T.restrict(key, {v}, 'hyp')
def negate(S, h, why):
    kind, key, v = h
    if kind == 'let': S.lrestrict(key, S.lc[key]-{v}, why)
    elif kind == 'cell_in': S.restrict(key, {0}, why)
    elif kind == 'cell_out': S.restrict(key, S.cand[key]-{0}, why)
    elif kind == 'dig': S.restrict(key, S.cand[key]-{v}, why)

G_STATE = None
def init(state): 
    global G_STATE; G_STATE = state
def run_trial(h):
    import engine2; engine2.LIGHT_MODE = True
    T = G_STATE.copy()
    try:
        apply_hyp(T, h); local_prop(T)
    except Contradiction as e:
        return (h, len(T.log), str(e), [x for x in T.log])
    return None

def line_job(job):
    import engine2; engine2.LIGHT_MODE = True
    tag, lvl = job
    T = G_STATE.copy(); n0 = len(T.log)
    try:
        unit_line(T, tag, dict(LINES)[tag], lvl)
    except Contradiction:
        return (tag, lvl, None)
    return (tag, lvl, T.log[n0:])
POOL = None
def main_lines(S):
    for lvl in (False, True):
        jobs = [(tag, lvl) for tag, cl in LINES]
        with mp.get_context('fork').Pool(4, initializer=init, initargs=(S,)) as pool:
            res = pool.map(line_job, jobs, chunksize=1)
        fired = []
        for tag, l, log in res:
            if not log: continue
            for e in log:
                if e[0] == 'cell': S.restrict(e[1], S.cand[e[1]] - set(e[2]), e[3])
                else: S.lrestrict(e[1], S.lc[e[1]] - set(e[2]), e[3])
            fired.append(tag)
        if fired: return (tuple(fired), lvl)
    return None

if __name__ == '__main__':
    import os, engine2
    engine2.LIGHT_MODE = False
    S = State(); t0 = time.time(); steps = []
    if os.path.exists('state3.pkl'):
        S, steps = pickle.load(open('state3.pkl','rb')); print('resumed', len(steps), 'steps')
    prev = snapshot(S); LASTLOG = len(S.log)
    def record(kind, info):
        global prev
        cur = snapshot(S)
        newin = sorted(p for p in cur[0] if cur[0][p] is True and prev[0][p] is None)
        newout = sorted(p for p in cur[0] if cur[0][p] is False and prev[0][p] is None)
        newd = {p:v for p,v in cur[1].items() if p not in prev[1]}
        newl = {c:v for c,v in cur[2].items() if c not in prev[2]}
        global LASTLOG
        lg = S.log[LASTLOG:]; LASTLOG = len(S.log)
        steps.append(dict(kind=kind, info=info, newin=newin, newout=newout, newd=newd, newl=newl, log=lg,
                          lc={k:sorted(v) for k,v in S.lc.items()}, cand={p:sorted(v) for p,v in S.cand.items()}))
        bad = S.check_sol()
        short = info if kind != 'trial' else (info[0], info[1], info[2])
        print(f"[{len(steps)}] {kind} {short} +in{len(newin)} +out{len(newout)} +dig{len(newd)} {newl} t={time.time()-t0:.0f}s {'BAD '+bad if bad else ''}", flush=True)
        prev = cur
        pickle.dump(steps, open('steps3.pkl','wb')); pickle.dump((S, steps), open('state3.pkl','wb'))
    while not solved(S):
        n0 = len(S.log); cheap(S)
        if len(S.log) > n0: record('cheap', None); continue
        f = main_lines(S)
        if f: cheap(S); record('line', f); continue
        H = hyps(S)
        print(f"   {len(H)} hypotheses...", flush=True)
        res = []
        with mp.get_context('fork').Pool(4, initializer=init, initargs=(S,)) as pool:
            for r in pool.imap_unordered(run_trial, H, chunksize=1):
                if r:
                    res.append(r)
                    if len(res) >= 3: break
            pool.terminate()
        if not res: print("STUCK"); break
        res.sort(key=lambda r: r[1])
        h, ln, msg, chain = res[0]
        negate(S, h, f"trial {h}")
        cheap(S)
        record('trial', (h, ln, msg, chain[:60], len(res)))
    print("solved" if solved(S) else "not solved", round(time.time()-t0))
