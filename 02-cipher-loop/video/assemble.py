import json, re
body = json.load(open('body_steps.json'))
n = len(body)
js = []
for k, st in enumerate(body):
    ch = ('Chapter 4 · The Time-Lapse', 'Every remaining deduction, in order', 'mint') if st.get('montage') else ('Chapter 3 · Probing the Loop', 'What-ifs that crack the grid open', 'violet')
    js.append({'chapter': ch[0], 'chapterSub': ch[1], 'pal': ch[2], 'title': st['title'], 'beats': st['beats']})
open('script_body.js', 'w').write('window.STEPS_BODY = ' + json.dumps(js, ensure_ascii=False) + ';\n')
final = "window.STEPS = [].concat(window.STEPS_HEAD, window.STEPS_MID, window.STEPS_BODY, [{ kind:'final', dur:16 }]);\n"
open('script.js', 'w').write(open('script_head.js').read() + open('script_mid.js').read() + open('script_body.js').read() + final)
print('body steps', n)
