"""Generate script_body.js (engine-derived steps) + verification pack from the path-search pickle."""
import pickle, json, re, sys
import os
SOLVER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'solver')
sys.path.insert(0, SOLVER)
from engine2 import State, LINES, line_patterns, SOL, SOLL, N, LET

STEPS = pickle.load(open(os.path.join(SOLVER, 'steps3.pkl'), 'rb'))
START = int(sys.argv[1]) if len(sys.argv) > 1 else 31          # engine steps before this are narrated by hand
CL = dict(LINES)
cid = lambda p: f"r{p[0]}c{p[1]}"

def state_from(rec):
    S = State()
    if rec is None: return S
    S.cand = {p: set(v) for p, v in rec['cand'].items()}; S.lc = {k: set(v) for k, v in rec['lc'].items()}
    return S

def status(c):
    if 0 not in c: return 'in'
    if set(c) == {0}: return 'out'
    return None

def reason(msg):
    m = re.match(r"line (\w+) infeasible", msg)
    if m: return f"{{{m.group(1)}}} could no longer fit its group totals"
    if msg.startswith('inside disconnected'): return "the shaded region would split into separate pieces"
    if msg.startswith('outside pocket'): return "an empty pocket would be sealed inside the loop"
    m = re.match(r"123 at \((\d+), (\d+)\)", msg)
    if m: return f"[r{m.group(1)}c{m.group(2)}] couldn’t get the right number of loop walls"
    m = re.match(r"\((\d+), (\d+)\) empty", msg)
    if m: return f"[r{m.group(1)}c{m.group(2)}] would have no possible digit left"
    m = re.match(r"letter (\w) empty", msg)
    if m: return f"no digit would be left for ${m.group(1)}"
    m = re.match(r"digit (\d) unused", msg)
    if m: return f"no letter would be left for the digit {m.group(1)}"
    if msg.startswith('2x2'): return "the loop would touch itself at a corner"
    return "the grid runs into a contradiction"

def hyp_text(h):
    kind, key, v = h
    if kind == 'cell_in': return f"What if [{cid(key)}] were **inside** the loop?"
    if kind == 'cell_out': return f"What if [{cid(key)}] were **empty**?"
    if kind == 'let': return f"What if ${key} were **{v}**?"
    return f"What if [{cid(key)}] were **{v}**?"

def concl_text(h):
    kind, key, v = h
    if kind == 'cell_in': return f"So [{cid(key)}] is **empty**."
    if kind == 'cell_out': return f"So [{cid(key)}] is **inside**."
    if kind == 'let': return f"So ${key} isn’t {v}."
    return f"So [{cid(key)}] isn’t {v}."

def cam_for(cells):
    if not cells: return 'all'
    rs = [p[0] for p in cells]; cs = [p[1] for p in cells]
    r0, r1, c0, c1 = max(1, min(rs) - 1), min(N, max(rs) + 1), max(1, min(cs) - 1), min(N, max(cs) + 1)
    if (r1 - r0) > 6 or (c1 - c0) > 7: return 'all'
    return f"r{r0}c{c0}:r{r1}c{c1}"

def ghost_cascade(before, chain, h):
    cand = {p: set(v) for p, v in before['cand'].items()}
    gin, gout, gd = [], [], {}
    for e in chain:
        if e[0] != 'cell': continue
        p = e[1]; old = set(cand[p]); cand[p] -= set(e[2])
        so, sn = status(old), status(cand[p])
        if sn and sn != so: (gin if sn == 'in' else gout).append(p)
        if len(cand[p]) == 1 and 0 not in cand[p] and len(old) > 1: gd[p] = next(iter(cand[p]))
    return gin[:24], gout[:24], dict(list(gd.items())[:10])

NARR_IN = {(1,11),(3,11),(5,11),(7,11),(8,11),(9,11),(3,10),(3,12),(1,9),(5,9),(8,9),(11,9)}
NARR_OUT = {(10,11),(2,11),(4,11),(6,11),(3,9),(2,10),(2,9)}
SHOWN = {'in': set(NARR_IN), 'out': set(NARR_OUT), 'd': {(3,11)}, 'let': {'J','F','A'}}
def acts_for(rec, prev, t0=1.2, gap=0.32):
    acts = []; t = t0
    ins = [cid(p) for p in rec['newin'] if p not in SHOWN['in']]; outs = [cid(p) for p in rec['newout'] if p not in SHOWN['out']]
    SHOWN['in'] |= set(rec['newin']); SHOWN['out'] |= set(rec['newout'])
    if ins: acts.append([round(t, 2), 'in', *ins]); t += gap + 0.04 * len(ins)
    if outs: acts.append([round(t, 2), 'out', *outs]); t += gap + 0.03 * len(outs)
    for p, v in sorted(rec['newd'].items()):
        if p in SHOWN['d']: continue
        SHOWN['d'].add(p); acts.append([round(t, 2), 'd', cid(p), v]); t += 0.18
    for L, v in rec['newl'].items():
        if L in SHOWN['let']: continue
        SHOWN['let'].add(L); acts.append([round(t, 2), 'let', L, v]); t += 0.4
    for L in LET:
        a = rec['lc'][L]; b = prev['lc'][L] if prev else list(range(10))
        if a != b and len(a) > 1: acts.append([round(t, 2), 'lc', L, ''.join(map(str, a))])
    return acts

def summary(rec):
    bits = []
    ni, no, nd = len(rec['newin']), len(rec['newout']), len(rec['newd'])
    if ni: bits.append(f"{ni} cell{'s' if ni > 1 else ''} inside")
    if no: bits.append(f"{no} empty")
    if nd: bits.append(f"{nd} digit{'s' if nd > 1 else ''}")
    for L, v in rec['newl'].items(): bits.append(f"${L} = {v}")
    return ', '.join(bits)

def cheap_reason(log):
    kinds = set()
    for e in log or []:
        w = e[3]
        if w.startswith('123rule'): kinds.add('123')
        elif w.startswith('2x2'): kinds.add('2x2')
        elif w.startswith('topo'): kinds.add('topo')
        elif w.startswith('latin'): kinds.add('latin')
        elif w.startswith('line'): kinds.add('line')
        else: kinds.add('let')
    out = []
    if '123' in kinds: out.append('the 1/2/3 wall counts')
    if '2x2' in kinds: out.append('no touching at corners')
    if 'topo' in kinds: out.append('keeping the region in one piece with no holes')
    if 'latin' in kinds: out.append('no repeats')
    if 'let' in kinds: out.append('the cipher')
    return ', '.join(out) if out else 'the rules'

def line_tags(rec):
    tg = rec['info'][0]
    return list(tg) if isinstance(tg, (tuple, list)) else [tg]
def line_beat(rec, prev):
    tags, w123 = line_tags(rec), rec['info'][1]
    # pick the line that changed most for the diagram
    def gain(tag):
        k = int(tag[1:]); return sum(1 for p in rec['newin'] + rec['newout'] if (p[1] if tag[0]=='C' else p[0]) == k)
    tag = max(tags, key=gain)
    S = state_from(prev)
    try:
        pats = line_patterns(S, tag, CL[tag], w123, cap=12)
    except Exception:
        pats = []
    cells = [p for p in S.cand if (p[1] if tag[0] == 'C' else p[0]) == int(tag[1:])]
    cells.sort()
    forced = ''.join('1' if status(rec['cand'][p]) == 'in' else '0' if status(rec['cand'][p]) == 'out' else '?' for p in cells)
    pp = [''.join(str(x) for x in pt) for pt, _ in pats]
    clue = '[' + ', '.join(re.sub(r'([A-J])', r'$\1', tk) for tk in CL[tag]) + ']'
    s = summary(rec); n = len(pp)
    if n == 1:
        txt = f"{{{tag}}} can now fit its groups {clue} in **only one way**" + (f": {s}." if s else ", which narrows its digits.")
    else:
        cnt = f"{n}+" if n == 12 else str(n)
        txt = f"Every way {{{tag}}} can still fit {clue} ({cnt} ways) " + (f"agrees: {s}." if s else "narrows its digits.")
    acts = [[0.4, 'diag', {'type': 'arr', 'tag': tag, 'clueText': clue, 'pats': pp, 'more': len(pp) == 12, 'forced': forced}]]
    acts += acts_for(rec, prev, t0=0.6 + 0.32 * len(pp) + 0.8)
    return {'t': txt, 'cam': tag, 'hl': {'cyan': [tag]}, 'tok': [tag], 'acts': acts}

def build(start, max_steps=999):
    out = []; verify = []
    i = start
    while i < len(STEPS) and len(out) < max_steps:
        rec = STEPS[i]; prev = STEPS[i - 1] if i > 0 else None
        if rec['kind'] == 'trial':
            h, ln, msg, chain = rec['info'][0], rec['info'][1], rec['info'][2], rec['info'][3]
            gin, gout, gd = ghost_cascade(prev, chain, h)
            hcell = h[1] if h[0] != 'let' else None
            focus = ([hcell] if hcell else []) + gin + gout
            b1 = {'t': hyp_text(h), 'cam': cam_for(focus[:8]), 'hl': {'pink': [cid(hcell)]} if hcell else {},
                  'acts': ([[0.9, 'ghostin', cid(hcell)]] if h[0] == 'cell_in' else [[0.9, 'ghostout', cid(hcell)]] if h[0] == 'cell_out' else
                           [[0.9, 'ghost', cid(hcell), h[2]]] if h[0] == 'dig' else [])}
            casc = []
            if gin: casc.append([1.0, 'ghostin', *[cid(p) for p in gin]])
            if gout: casc.append([1.3, 'ghostout', *[cid(p) for p in gout]])
            for k, (p, v) in enumerate(gd.items()): casc.append([1.6 + 0.15 * k, 'ghost', cid(p), v])
            casc.append([2.6, 'bad'])
            b2 = {'t': f"Follow the forced consequences (pink) and {reason(msg)}. !!Contradiction!!", 'acts': casc}
            b3 = {'t': concl_text(h) + (f" Knock-on: {summary(rec)}." if summary(rec) else ''), 'hl': {},
                  'acts': [[0.3, 'clearGhosts']] + acts_for(rec, prev, t0=0.8)}
            beats = [b1, b2, b3]
            j = i + 1
            while j < len(STEPS) and STEPS[j]['kind'] != 'trial' and len(beats) < 5:
                r2, p2 = STEPS[j], STEPS[j - 1]
                if r2['kind'] == 'line': beats.append(line_beat(r2, p2))
                else:
                    s = summary(r2)
                    if s: beats.append({'t': f"Then {cheap_reason(r2.get('log'))} give{'s' if False else ''}: {s}.", 'acts': acts_for(r2, p2, t0=1.0)})
                j += 1
            title = {'cell_in': 'Can [%s] be inside?', 'cell_out': 'Must [%s] be inside?', 'dig': 'Testing [%s]'}.get(h[0], 'Testing $%s')
            title = title % (cid(hcell) if hcell else h[1])
            out.append({'title': title, 'beats': beats, 'engine': list(range(i, j))})
            i = j
        else:
            beats = []
            j = i
            while j < len(STEPS) and STEPS[j]['kind'] != 'trial' and len(beats) < 3:
                r2, p2 = STEPS[j], STEPS[j - 1]
                if r2['kind'] == 'line': beats.append(line_beat(r2, p2))
                else:
                    s = summary(r2)
                    if s: beats.append({'t': f"By {cheap_reason(r2.get('log'))}: {s}.", 'acts': acts_for(r2, p2, t0=1.0)})
                j += 1
            if beats: out.append({'title': ('Fitting ' + ' & '.join(list(dict.fromkeys('{%s}' % t for k in range(i, j) if STEPS[k]['kind'] == 'line' for t in line_tags(STEPS[k])))[:3])) or 'Knock-on effects', 'beats': beats, 'engine': list(range(i, j))})
            i = j
    return out

def short_reason(msg):
    m = re.match(r"line (\w+) infeasible", msg)
    if m: return f"{{{m.group(1)}}} can\u2019t fit its totals"
    if msg.startswith('inside disconnected'): return "the region splits"
    if msg.startswith('outside pocket'): return "a hole forms"
    m = re.match(r"123 at \((\d+), (\d+)\)", msg)
    if m: return f"[r{m.group(1)}c{m.group(2)}] gets the wrong wall count"
    m = re.match(r"\((\d+), (\d+)\) empty", msg)
    if m: return f"[r{m.group(1)}c{m.group(2)}] has no digit left"
    m = re.match(r"letter (\w) empty", msg)
    if m: return f"${m.group(1)} has no digit left"
    if msg.startswith('2x2'): return "the loop touches itself"
    return "contradiction"

def feed_beats(start):
    beats = []
    for i in range(start, len(STEPS)):
        rec, prev = STEPS[i], STEPS[i - 1]
        s = summary(rec)
        if not s and rec['kind'] != 'trial': continue
        changed = rec['newin'] + rec['newout'] + list(rec['newd'].keys())
        acts = acts_for(rec, prev, t0=0.55, gap=0.18)
        if rec['kind'] == 'trial':
            h, msg = rec['info'][0], rec['info'][2]
            kind, key, v = h
            if kind == 'let': head, res = f"If ${key} = {v}", f"${key} \u2260 {v}"
            elif kind == 'dig': head, res = f"If [{cid(key)}] = {v}", f"[{cid(key)}] \u2260 {v}"
            elif kind == 'cell_in': head, res = f"If [{cid(key)}] were inside", f"[{cid(key)}] **empty**"
            else: head, res = f"If [{cid(key)}] were empty", f"[{cid(key)}] **inside**"
            text = f"{head}, {short_reason(msg)} \u21d2 {res}" + (f"; {s}" if s and kind == 'let' else '')
            pre = ([[0.15, 'ghostin', cid(key)]] if kind == 'cell_in' else [[0.15, 'ghostout', cid(key)]] if kind == 'cell_out' else [[0.15, 'ghost', cid(key), v]] if kind == 'dig' else [])
            acts = pre + [[0.5, 'clearGhosts']] + [[round(a[0] + 0.15, 2)] + a[1:] for a in acts]
            beats.append({'t': text, 'feed': True, 'icon': '\u26a1', 'iconCol': '#ff4fd8', 'cam': 'all', 'hl': {'pink': [cid(key)]} if kind != 'let' else {}, 'acts': acts})
        elif rec['kind'] == 'line':
            tags = line_tags(rec)
            text = ' '.join('{%s}' % t for t in tags[:4]) + ('\u2026' if len(tags) > 4 else '') + f" fit{'s' if len(tags) == 1 else ''} only one way here \u21d2 {s}"
            beats.append({'t': text, 'feed': True, 'icon': '\u25a4', 'iconCol': '#4ff0ff', 'cam': 'all', 'hl': {'cyan': [cid(p) for p in changed[:14]]}, 'tok': tags[:4], 'acts': acts})
        else:
            beats.append({'t': f"{cheap_reason(rec.get('log')).capitalize()} \u21d2 {s}", 'feed': True, 'icon': '\u25c6', 'iconCol': '#ffd166', 'cam': 'all', 'hl': {'gold': [cid(p) for p in changed[:14]]}, 'acts': acts})
    return beats

if __name__ == '__main__':
    DET = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    a_idx = next(i for i, s in enumerate(STEPS) if s['newl'].get('A') == 4)
    # catch-up: facts the engine settled before A=4 that the hand narration didn't show
    catch = []
    for i in range(0, a_idx + 1):
        rec, prev = STEPS[i], STEPS[i - 1] if i else None
        acts = acts_for(rec, prev, t0=0.5, gap=0.2)
        acts = [a for a in acts if a[1] in ('in', 'out', 'd', 'let', 'lc')]
        if any(a[1] == 'let' for a in acts) and not any(a[1] in ('in','out','d') for a in acts) and rec['kind'] == 'trial':
            h = rec['info'][0]
            catch.append({'t': f"If ${h[1]} were {h[2]}, {short_reason(rec['info'][2])} \u21d2 " + summary(rec), 'feed': True, 'icon': '\u26a1', 'iconCol': '#ff4fd8', 'cam': 'all', 'acts': acts}); continue
        if any(a[1] in ('in', 'out', 'd', 'let') for a in acts) and summary(rec):
            if rec['kind'] == 'trial':
                kind, key, v = rec['info'][0]
                head = {'cell_in': f"If [{cid(key)}] were inside", 'cell_out': f"If [{cid(key)}] were empty", 'dig': f"If [{cid(key)}] were {v}"}.get(kind, f"If ${key} were {v}")
                catch.append({'t': f"{head}, {short_reason(rec['info'][2])} \u21d2 " + summary(rec), 'feed': True, 'icon': '\u26a1', 'iconCol': '#ff4fd8', 'cam': 'all', 'acts': acts}); continue
            why = ('{' + '} {'.join(line_tags(rec)[:4]) + '} fit only these ways') if rec['kind'] == 'line' else cheap_reason(rec.get('log')).capitalize()
            catch.append({'t': f"{why} \u21d2 " + summary(rec), 'feed': True, 'icon': '\u25a4' if rec['kind']=='line' else '\u25c6', 'iconCol': '#4ff0ff', 'cam': 'all', 'acts': acts})
    det = []
    if catch:
        det.append({'title': 'Meanwhile, line by line', 'beats': [{'t': 'Single-line checks made along the way also settle a few more cells:', 'cam': 'all', 'dur': 4}] + catch, 'engine': []})
    START = a_idx + 1
    det += build(START, DET)
    used = max((max(s['engine']) for s in det if s['engine']), default=START - 1) + 1
    fb = feed_beats(used)
    PER = 24
    mont = []
    for k in range(0, len(fb), PER):
        part = fb[k:k + PER]
        intro = {'t': 'From here the deductions come thick and fast. Each line below is one genuine step: **\u26a1 a what-if that breaks**, **\u25a4 a row or column that fits only one way**, or **\u25c6 a loop rule**.' if k == 0 else 'The time-lapse continues\u2026', 'cam': 'all', 'dur': 6.5 if k == 0 else 3}
        mont.append({'title': f'Time-lapse \u00b7 part {k // PER + 1}', 'beats': [intro] + part, 'engine': [], 'montage': True})
    steps = det + mont
    print(len(det), 'detailed steps; feed beats', len(fb), 'in', len(mont), 'montage pages')
    json.dump(steps, open('body_steps.json', 'w'), indent=1)
    print(len(steps), 'video steps from', len(STEPS) - START, 'engine steps')
