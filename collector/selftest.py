"""수집기 회귀 시험 — 받아 둔 한글 첨부(cache/)를 모두 다시 읽어 기준값(fixtures.json)과 비교.

서식이 바뀌어 hwpread.py·collect.py 를 고칠 때, 예전 문서를 읽는 결과가 그대로인지 확인한다.
  python collector/selftest.py           비교 (다르면 종료코드 1)
  python collector/selftest.py --update  지금 결과를 새 기준값으로 저장 (고친 결과가 맞다고 확인한 뒤에만)
"""
import glob, hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import collect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(os.path.dirname(__file__), 'fixtures.json')

def summary(path):
    name = os.path.basename(path); board = name.split('_')[0]
    src = dict(type='x', board=int(board), id=0, title='', posted='2026-01-01')
    if board == '24':
        day, ev = collect.daily(path, 2026, src)
        rows = [(day, e['body'], e['time'], e['text']) for e in ev]
    else:
        ev = collect.committee_plan(path, 2026, src) + collect.plenary_plan(path, 2026, src, '')
        rows = [(e['start'][5:], e['end'][5:], e['body'], e['time'], e['text']) for e in ev]
    h = hashlib.sha1(json.dumps(rows, ensure_ascii=False).encode()).hexdigest()[:12]
    return dict(n=len(rows), bodies=sorted({r[-3] if board != '24' else r[1] for r in rows}), hash=h)

def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'cache', '*.hwp')))
    now = {os.path.basename(f): summary(f) for f in files}
    if '--update' in sys.argv:
        json.dump(now, open(FIX, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'기준값 저장 {len(now)}건'); return 0
    if not os.path.exists(FIX):
        print('기준값 없음 — 먼저 --update'); return 1
    base = json.load(open(FIX, encoding='utf-8'))
    bad = 0
    for k, v in now.items():
        b = base.get(k)
        if b is None: continue                      # 새로 받은 문서는 비교 대상 아님
        if b['hash'] != v['hash']:
            bad += 1
            print(f'달라짐 {k}: 일정 {b["n"]}→{v["n"]}, 회의체 {b["bodies"]}→{v["bodies"]}')
    print(f'비교 {len([k for k in now if k in base])}건 · 달라짐 {bad}건')
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
