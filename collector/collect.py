"""전북특별자치도의회 회의운영 일정 수집기.

출처 세 갈래 (모두 도의회 누리집, 인증 없음):
  1) 월간 의사일정  /jbassem/scheduleMonth          → 회기(시작·끝) — 연간 계획 포함
  2) 의사일정 게시판 /jbassem/board/23 (한글 첨부)   → 회기별 상임위·본회의 날짜별 계획
  3) 일일회의운영상황 /jbassem/board/24 (한글 첨부) → 그날 실제 운영 — 계획보다 우선

규칙: 같은 날짜에 일일회의운영상황이 있으면 그날은 그것이 정답이다.
      계획표는 같은 회기에 여러 번 다시 올라오므로 가장 최근 글만 쓴다.
"""
import json, os, re, sys, time, urllib.request, datetime as dt
sys.path.insert(0, os.path.dirname(__file__))
import hwpread
import ai_read

BASE = 'https://www.jbstatecouncil.jeonbuk.kr'
MONTHLY_URL = BASE + '/jbassem/scheduleMonth'
BOARD_PLAN_URL = BASE + '/jbassem/board/23'
BOARD_DAILY_URL = BASE + '/jbassem/board/24'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'cache')
DATA = os.path.join(ROOT, 'public', 'data')
SINCE_SESSION = int(os.environ.get('JBC_SINCE', '429'))   # 13대 첫 회기
DAILY_PAGES = int(os.environ.get('JBC_DAILY_PAGES', '3'))
os.makedirs(CACHE, exist_ok=True); os.makedirs(DATA, exist_ok=True)

def get(path, binary=False):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'Mozilla/5.0 jbe-council-calendar'})
    for k in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                b = r.read()
                return b if binary else b.decode('utf-8', 'replace')
        except Exception as e:
            if k == 2: raise
            time.sleep(2)

# ---------- 1) 회기 ----------
def sessions():
    s = get('/jbassem/scheduleMonth')
    out = []
    for t, u, a, b in re.findall(r"title : '([^']*)',\s*url : '([^']*)',.*?start : '([^']*)',\s*end : '([^']*)'", s, re.S):
        m = re.search(r'제(\d+)회', t)
        end = (dt.date.fromisoformat(b) - dt.timedelta(days=1)).isoformat()   # FullCalendar end 는 '다음날'
        kind = '정례회' if '정례회' in t else '임시회'
        out.append(dict(no=int(m.group(1)) if m else None, title=t, kind=kind, start=a, end=end,
                        id=int(u.rsplit('/', 1)[-1])))
    return out

# ---------- 게시판 ----------
def board_list(board, pages):
    rows = []
    for p in range(1, pages + 1):
        s = get(f'/jbassem/board/{board}/{p}')
        found = re.findall(r'href="/jbassem/board/\d+/\d+/read/(\d+)">\s*(.*?)\s*</a>.*?col_date">([^<]*)<', s, re.S)
        if not found: break
        rows += [dict(id=int(i), title=re.sub(r'\s+', ' ', t).strip(), posted=d.strip()) for i, t, d in found]
    return rows

def attachment(board, pid):
    """첨부 한글 파일을 캐시에 받아 경로 목록을 돌려준다(글 번호로 캐시)."""
    s = get(f'/jbassem/board/{board}/1/read/{pid}')
    files = []
    for fid in dict.fromkeys(re.findall(rf'/download/{pid}/(\d+)', s)):
        p = os.path.join(CACHE, f'{board}_{pid}_{fid}.hwp')
        if not os.path.exists(p):
            open(p, 'wb').write(get(f'/jbassem/board/{board}/1/download/{pid}/{fid}', binary=True))
        files.append(p)
    return files

# ---------- 날짜 풀이 ----------
def parse_md(text, year):
    """'11.12.(목)' '11.14.(토)/~11.15.(일)' '2026./11.9.(월)' → (시작, 끝)"""
    ds = re.findall(r'(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\(', text)
    if not ds: return None
    y = re.search(r'(20\d\d)\s*\.', text)
    yy = int(y.group(1)) if y else year
    d = [dt.date(yy, int(m), int(dd)) for m, dd in ds]
    if len(d) > 1 and d[1] < d[0]: d[1] = d[1].replace(year=yy + 1)
    return d[0].isoformat(), d[-1].isoformat()

TIME = re.compile(r'^\s*(\d{1,2}:\d{2})\s*(.*)$')

def split_cell(text):
    """칸 글 → [(시각, 내용)] — 시각으로 시작하는 줄이 나오면 새 항목."""
    items, cur_t, buf = [], '', []
    for line in text.split('\n'):
        m = TIME.match(line)
        if m:
            if buf: items.append((cur_t, '\n'.join(buf).strip()))
            cur_t, buf = m.group(1), ([m.group(2)] if m.group(2).strip() else [])
        elif line.strip():
            buf.append(line.rstrip())
    if buf: items.append((cur_t, '\n'.join(buf).strip()))
    return [(t, x) for t, x in items if x]

def tidy(x):
    x = re.sub(r'[\ue000-\uf8ff]', '', x)   # 한글 문서의 기호 글꼴 글머리표(사용자 정의 영역)
    x = re.sub(r'(?<![\S])((?:[가-힣] ){1,}[가-힣])(?![\S])', lambda m: m.group(1).replace(' ', ''), x)  # '본 회 의' → '본회의'
    x = re.sub(r'[ \t]{2,}', ' ', x)
    x = re.sub(r'^\s*[οo○◦·]\s*', '', x, flags=re.M)
    return '\n'.join(l.strip() for l in x.split('\n') if l.strip())

def is_minor(text):
    """회의가 아닌 날 — '자료 수집'이 들어 있고 대상 기관(-○○) 줄이 없는 일정
    (의정활동자료수집, 행정사무감사 자료수집, 예산안 심사 자료 수집‧검토, 의정활동 자료 수집 및 논의 등)"""
    flat = re.sub(r'[\s·ㆍ‧,/]', '', text)
    return '자료수집' in flat and not any(l.strip().startswith('-') for l in text.split('\n'))

def mk(start, end, time_, body, text, src, meeting=''):
    text = tidy(text)
    return dict(start=start, end=end, time=time_, body=body, meeting=meeting, text=text, source=src,
                minor=is_minor(text))

# ---------- 2) 상임위원회 의사일정 ----------
def committee_plan(path, year, src):
    ev = []; header = None; last_title = ''
    for b in hwpread.read(path):
        if b['type'] == 'para':
            m = re.search(r'■\s*(.+?)\s*의사일정', b['text'])
            if m: last_title = m.group(1).strip()
            continue
        g = hwpread.grid(b['cells'])
        R = max(r for r, c in g) + 1
        h0 = g.get((0, 0), '').replace(' ', '')
        if '일시' in h0 and '위원회' in g.get((0, 1), '') + g.get((0, 2), ''):
            header = {c['col']: c['text'].strip() for c in b['cells'] if c['row'] == 0}
            # 날짜별 칸 하나하나(병합 포함)를 그대로 읽는다
            for c in b['cells']:
                if c['row'] == 0 or c['col'] == 0 or not c['text'].strip(): continue
                d = parse_md(g.get((c['row'], 0), ''), year)
                if not d: continue
                if c['colspan'] >= 3:             # 모든 위원회 칸을 덮는 줄 = 본회의 등 전체 일정
                    for t, x in split_cell(c['text']):
                        ev.append(mk(d[0], d[1], t, '본회의' if '본회의' in tidy(x).replace(' ', '') else '전체', x, src))
                    continue
                name = header.get(c['col'], '')
                for t, x in split_cell(c['text']):
                    ev.append(mk(d[0], d[1], t, name, x, src))
        elif '일시' in h0 and '내' in g.get((0, 2), '') + g.get((0, 1), ''):
            # 예산결산특별위원회처럼 '일시 | 시각 | 내용' 꼴
            body = last_title or '특별위원회'
            for r in range(1, R):
                d0 = g.get((r, 0), ''); d = parse_md(d0, year)
                if not d: continue
                mt = re.search(r'제\s*\d+\s*차\s*회의', d0)
                t = g.get((r, 1), '').strip(); x = g.get((r, 2), '')
                if not TIME.match(t): t, x = '', t + '\n' + x
                if x.strip(): ev.append(mk(d[0], d[1], TIME.match(t).group(1) if t else '', body, x, src,
                                           meeting=mt.group(0).replace(' ', '') if mt else ''))
    return ev

# ---------- 2') 본회의 의사일정 ----------
def plenary_plan(path, year, src, title):
    ev = []
    for b in hwpread.read(path):
        if b['type'] != 'table': continue
        g = hwpread.grid(b['cells'])
        R = max(r for r, c in g) + 1
        groups = {}
        for r in range(R):
            k = g.get((r, 0), '')
            d = parse_md(k, year)
            if not d: continue
            t = re.search(r'(\d{1,2}:\d{2})', k)
            groups.setdefault((d, t.group(1) if t else ''), []).append(g.get((r, 1), ''))
        for (d, t), lines in groups.items():
            body = '\n'.join(x.strip() for x in lines if x.strip())
            n = re.search(r'제\s*(\d+)\s*차\s*본회의', title)
            agenda = [l.strip() for l in body.split('\n') if re.match(r'\s*\d+\.', l)]
            same = next((e for e in ev if (e['start'], e['time']) == (d[0], t)), None)
            if same: same['agenda'] += agenda; continue
            ev.append(dict(start=d[0], end=d[1], time=t, body='본회의', meeting=f'제{n.group(1)}차' if n else '',
                           text='', agenda=agenda, source=src, minor=False))
    for e in ev:
        e['text'] = '\n'.join(e['agenda'][:3]) + (f'\n외 {len(e["agenda"]) - 3}건' if len(e['agenda']) > 3 else '')
    return ev

# ---------- 3) 일일회의운영상황 ----------
def daily(path, year, src):
    lines = []
    for b in hwpread.read(path):
        if b['type'] == 'para': lines.append(b['text'])
        else: lines += [c['text'] for c in sorted(b['cells'], key=lambda c: (c['row'], c['col']))]
    lines = '\n'.join(lines).split('\n')
    day, ev, cur = None, [], None
    for l in lines:
        m = re.search(r'오늘\s*\(\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.', l)
        if m: day = dt.date(year, int(m.group(1)), int(m.group(2))).isoformat(); continue
        if re.match(r'\s*■', l) and day and '오늘' not in l: break       # 다음 단락(내일 일정 등)
        m = re.match(r'\s*▣\s*(.+?)\s*$', l)
        if m and day:
            head = m.group(1)
            br = re.search(r'[\[(]\s*([^\])]+?)\s*[\])]', head); when = br.group(1) if br else ''
            head = re.sub(r'[\[(][^\])]*[\])]', '', head).strip()
            head = re.sub(r'^제\s*\d+\s*회\s*(?:정례회|임시회)?\s*(?:폐회\s*중)?\s*', '', head)
            mt = re.search(r'제?\s*(\d+)\s*차', head); meeting = f'제{mt.group(1)}차' if mt else ''
            name = re.sub(r'제?\s*\d+\s*차', '', head).strip()
            if '본회의' in name: name = '본회의'
            cur = dict(start=day, end=day, time=when, body=name, meeting=meeting, text='', source=src, minor=False)
            ev.append(cur); continue
        if cur and l.strip(): cur['text'] = (cur['text'] + '\n' + l.strip()).strip()
    for e in ev: e['text'] = tidy(e['text'])
    return day, ev

# ---------- 점검 ----------
class Health:
    """수집 점검 기록. fail = 그 자료는 직전 정상본 유지, warn = 반영했지만 사람이 볼 것."""
    def __init__(self): self.items = []
    def add(self, level, area, msg, link='', notify=None):
        # notify: 메일로 알릴 문제(수집이 제대로 안 됨). 기본은 실패만
        self.items.append(dict(level=level, area=area, msg=msg, link=link,
                               notify=(level == 'fail') if notify is None else notify))
        print(f'  [{level}] {area}: {msg}')
    @property
    def status(self):
        lv = {i['level'] for i in self.items}
        return 'fail' if 'fail' in lv else 'warn' if 'warn' in lv else 'ok'

RANGE = re.compile(r'(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\(.\)\s*~\s*(?:(20\d\d)\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})')
def doc_range(path):
    """문서 머리의 회기 기간 'YYYY. M. D.(요) ~ M. D.(요)' — 회기 정보 교차 확인용"""
    texts = []
    for b in hwpread.read(path)[:12]:
        texts += [b['text']] if b['type'] == 'para' else [c['text'] for c in b['cells']]
    m = RANGE.search(' '.join(texts))
    if not m: return None
    y1, m1, d1, y2, m2, d2 = m.groups()
    a = dt.date(int(y1), int(m1), int(d1)); b = dt.date(int(y2 or y1), int(m2), int(d2))
    if b < a: b = b.replace(year=b.year + 1)
    return a.isoformat(), b.isoformat()

def load_prev():
    try:
        return json.load(open(os.path.join(DATA, 'schedule.json'), encoding='utf-8'))
    except Exception:
        return None

KNOWN_BODY = re.compile(r'(위원회|본회의|개원식|간담회|전체)$')

def main():
    H = Health()
    prev = load_prev()
    prev_by_src = {}
    for e in (prev or {}).get('events', []):
        prev_by_src.setdefault(e['source']['id'], []).append(e)
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=9)))
    t = now.date().isoformat()

    # 1) 회기 — 못 받으면 전체를 직전 정상본으로 유지
    try:
        ss = sessions()
    except Exception as e:
        ss = []; H.add('fail', '월간 의사일정', f'접속 실패 ({e})', MONTHLY_URL)
    if not ss:
        if not any(i['area'] == '월간 의사일정' for i in H.items):
            H.add('fail', '월간 의사일정', '회기 0건 — 화면 구조 변경 의심 (events 배열 못 찾음)', MONTHLY_URL)
        return finish(prev, H, now, keep_all=True)
    if not any(s['start'] <= t <= s['end'] or s['start'] > t for s in ss):
        H.add('warn', '월간 의사일정', '오늘 이후 회기가 없음 — 다음 해 회기운영계획 미등록 가능', MONTHLY_URL)
    by_no = {s['no']: s for s in ss}
    events, docs = [], []

    # 2) 의사일정(안) — 회기·종류별 최신 글만
    try:
        posts = board_list(23, 4)
    except Exception as e:
        posts = []; H.add('fail', '의사일정 게시판', f'접속 실패 ({e})', BOARD_PLAN_URL)
    if not posts and not any(i['area'] == '의사일정 게시판' for i in H.items):
        H.add('fail', '의사일정 게시판', '글 목록 0건 — 게시판 구조 변경 의심', BOARD_PLAN_URL)
    if not posts and prev:
        keep = [e for e in prev['events'] if e['source']['type'] == '계획']
        events += keep; docs += [d for d in prev.get('documents', []) if d['type'] == '계획']
        print(f'  의사일정(안) 직전 정상본 {len(keep)}건 유지')
    latest = {}
    for p in posts:
        m = re.search(r'제(\d+)회', p['title'])
        if not m or int(m.group(1)) < SINCE_SESSION: continue
        no = int(m.group(1))
        kind = '상임위' if '상임위' in p['title'] else '본회의'
        key = (no, kind, re.sub(r'\(안\)|\s', '', re.sub(r'.*?(제[\d~]+차\s*본회의|상임위원회).*', r'\1', p['title'])))
        if key not in latest: latest[key] = p
    for (no, kind, _), p in sorted(latest.items()):
        year = int(by_no.get(no, {}).get('start', p['posted'])[:4])
        src = dict(type='계획', board=23, id=p['id'], title=p['title'], posted=p['posted'])
        link = BASE + f'/jbassem/board/23/1/read/{p["id"]}'
        ev, err, files = [], '', []
        try:
            files = attachment(23, p['id'])
            if not files: err = '첨부 없음'
            for f in files:
                ev += committee_plan(f, year, src) if kind == '상임위' else plenary_plan(f, year, src, p['title'])
                r = doc_range(f)
                s = by_no.get(no)
                if r and s and (r[0] != s['start'] or r[1] != s['end']):
                    H.add('warn', '회기 불일치', f'제{no}회 — 월간 의사일정 {s["start"]}~{s["end"]}, 의사일정(안) {r[0]}~{r[1]}', link)
        except Exception as e:
            err = f'읽기 오류 ({type(e).__name__}: {e})'
        # AI 는 처음 보는 글에만 — 같은 글은 내용이 안 바뀌므로 직전 정상본이 있으면 그것을 쓴다
        if not ev and files_ok(err) and not prev_by_src.get(p['id']):
            s0 = by_no.get(no); why = '첨부 없음'
            for f in attachment(23, p['id']):
                got, why = ai_read.read(f, '의사일정(안)', year, src, s0['start'] if s0 else f'{year}-01-01',
                                        s0['end'] if s0 else f'{year}-12-31')
                ev += got
            if ev:
                H.add('warn', 'AI 대신 읽음', f'{p["title"]} — 규칙 수집 0건, OpenRouter로 {len(ev)}건 읽음. 수집기 확인 필요', link, notify=True)
            else:
                err = (err + ', ' if err else '') + why
        if not ev:
            old = [x for x in prev_by_src.get(p['id'], [])]
            H.add('fail' if not old else 'warn', '의사일정(안) 읽기',
                  f'{p["title"]} — 일정 0건{", " + err if err else ""}. 서식 변경 의심' + (' · 직전 정상본 유지' if old else ''), link,
                  notify=True)
            ev = old
        odd = sorted({e['body'] for e in ev if not KNOWN_BODY.search(e['body']) and not e['body'].endswith('위원회')})
        if odd:
            H.add('warn', '의사일정(안) 읽기', f'{p["title"]} — 낯선 회의체 이름 {odd[:3]} (표 머리 변경 의심)', link)
        for e in ev: e['session'] = no
        events += ev; docs.append(src)
        print(f'계획 {no}회 {kind}: {p["title"]} · {len(ev)}건')

    # 3) 일일회의운영상황
    days = {}
    try:
        dposts = board_list(24, DAILY_PAGES)
    except Exception as e:
        dposts = []; H.add('fail', '일일회의운영상황', f'접속 실패 ({e})', BOARD_DAILY_URL)
    if not dposts and not any(i['area'] == '일일회의운영상황' for i in H.items):
        H.add('fail', '일일회의운영상황', '글 목록 0건 — 게시판 구조 변경 의심', BOARD_DAILY_URL)
    unread = 0
    if not dposts and prev:
        for e in prev['events']:
            if e['source']['type'] == '당일':
                days.setdefault(e['start'], []).append(e)
        docs += [d for d in prev.get('documents', []) if d['type'] == '당일']
        print(f'  일일회의운영상황 직전 정상본 {len(days)}일 유지')
    for p in dposts:
        src = dict(type='당일', board=24, id=p['id'], title=p['title'], posted=p['posted'])
        link = BASE + f'/jbassem/board/24/1/read/{p["id"]}'
        day, ev, err = None, [], ''
        try:
            for f in attachment(24, p['id']):
                day, ev = daily(f, int(p['posted'][:4]), src)
                r = doc_range(f)
                s = next((x for x in ss if day and x['start'] <= day <= x['end']), None)
                if r and s and (r[0] != s['start'] or r[1] != s['end']) and day >= t:
                    H.add('warn', '회기 불일치', f'제{s["no"]}회 — 월간 의사일정 {s["start"]}~{s["end"]}, 당일 운영상황 {r[0]}~{r[1]}', link)
        except Exception as e:
            err = f'{type(e).__name__}: {e}'
        if not day:   # 제목의 날짜로라도 그날을 잡는다
            m = re.search(r'(20\d\d)\.(\d{1,2})\.(\d{1,2})', p['title'].replace(' ', ''))
            day = dt.date(*map(int, m.groups())).isoformat() if m else None
        if day in days: continue
        if not ev and day and files_ok(err) and not prev_by_src.get(p['id']):
            why = '첨부 없음'
            for f in attachment(24, p['id']):
                got, why = ai_read.read(f, '일일회의운영상황', int(day[:4]), src, day, day)
                ev += [e for e in got if e['start'] == day == e['end']]
            if ev:
                H.add('warn', 'AI 대신 읽음', f'{p["title"]} — 규칙 수집 0건, OpenRouter로 {len(ev)}건 읽음. 수집기 확인 필요', link, notify=True)
            else:
                err = (err + ', ' if err else '') + why
        if not ev:
            old = prev_by_src.get(p['id'], [])
            if old:
                ev = old
            else:
                unread += 1
                ev = [dict(start=day, end=day, time='', body='안내', meeting='', source=src, minor=False,
                           text='일일회의운영상황 게시됨 — 자동으로 읽지 못함. 원문 확인')] if day else []
            if day and day >= addd(t, -7):
                H.add('warn', '일일회의운영상황 읽기', f'{p["title"]} — 내용 0건{", " + err if err else ""}. 서식 변경 의심'
                      + (' · 직전 정상본 유지' if prev_by_src.get(p['id']) else ''), link, notify=True)
        if day:
            days[day] = ev; docs.append(src)
    print('일일회의운영상황', len(days), '일', f'(못 읽음 {unread})')

    # 오늘 회의가 계획돼 있는데 당일 운영상황이 아직 없음 (오전 11시 이후에만 판단)
    if now.hour >= 11 and t not in days and any(e['start'] == t and not e['minor'] for e in events):
        H.add('warn', '일일회의운영상황', '오늘 회의 계획이 있는데 당일 운영상황이 목록에 없음 — 미게시 또는 목록 구조 변경', BOARD_DAILY_URL)

    # 4) 병합
    merge(events, days, ss)
    for d, ev in days.items(): events += ev
    # 다른 위원회·도청 예결 일정은 저장하지 않음 (읽기·점검은 전체로 한 뒤)
    events = [e for e in events if is_edu(e)]
    events.sort(key=lambda e: (e['start'], e['time'] or '99', e['body']))

    # 5) 양 급감 점검 — 출처 종류별 일정 수가 직전보다 30% 넘게 줄면 경고
    if prev:
        for kind in ('계획', '당일'):
            old_n = sum(1 for e in prev['events'] if e['source']['type'] == kind and is_edu(e))
            new_n = sum(1 for e in events if e['source']['type'] == kind)
            if old_n >= 20 and new_n < old_n * 0.7:
                H.add('warn', '양 급감', f'{"의사일정(안)" if kind == "계획" else "일일회의운영상황"} 일정 {old_n}건 → {new_n}건. 읽기 누락 의심',
                      notify=True)

    out = dict(sessions=ss, events=events, documents=docs)
    return finish(out, H, now, prev=prev)

EDU_RE = re.compile(r'교육청|교육감|교육비')
DO_RE = re.compile(r'전북특별자치도(?!의회|교육청)|도정|부지사')

def is_edu(e):
    """저장할 일정 — 교육위·본회의·예결특위(교육청 소관·공통)만. 화면(src/lib/data.ts isEdu)과 같은 기준
    예결특위: 교육청·교육감·교육비 → 교육청 / 전북특별자치도(도의회·도교육청 아님)·도정·부지사 → 도청(버림) / 둘 다 없으면 공통"""
    if e['body'] in ('교육위원회', '본회의', '안내'): return True
    if e['body'] != '예산결산특별위원회': return False
    if EDU_RE.search(e['text']): return True
    if DO_RE.search(e['text']): return False
    return True

def files_ok(err):
    """접속 오류가 아니라 '읽기'에 실패한 경우만 AI 로 넘긴다"""
    return 'URLError' not in err and 'HTTPError' not in err and 'timed out' not in err

def addd(d, n): return (dt.date.fromisoformat(d) + dt.timedelta(days=n)).isoformat()

def finish(out, H, now, keep_all=False, prev=None):
    """점검 결과를 붙여 저장. keep_all 이면 일정은 직전 정상본 그대로, 점검 결과만 갱신.
    종료코드: 2 = 새로 생긴 수집 문제 있음(메일 알림), 0 = 그 밖. 같은 문제는 한 번만 알린다."""
    stamp = now.isoformat(timespec='minutes')
    if out is None:
        out = dict(sessions=[], events=[], documents=[])
    before = prev if prev is not None else out
    prev_keys = {(i['area'], i['msg']) for i in ((before or {}).get('health') or {}).get('items', []) if i.get('notify')}
    if keep_all:
        last_ok = out.get('lastSuccess') or out.get('generated')
    else:
        last_ok = stamp
        out['generated'] = stamp
    out['lastSuccess'] = last_ok
    out['health'] = dict(checked=stamp, status=H.status, items=H.items)
    json.dump(out, open(os.path.join(DATA, 'schedule.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(out['health'], open(os.path.join(DATA, 'health.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    new = [i for i in H.items if i.get('notify') and (i['area'], i['msg']) not in prev_keys]
    report = ['## 도의회 회의운영 달력 수집 점검', '',
              f'- 점검 {stamp} · 상태 {H.status} · 마지막 정상 수집 {last_ok}', '']
    for i in H.items:
        mark = '🆕 ' if i in new else ''
        report.append(f'- {mark}[{"실패" if i["level"] == "fail" else "확인 필요"}] {i["area"]} — {i["msg"]}'
                      + (f' ([원문]({i["link"]}))' if i.get('link') else ''))
    if not H.items: report.append('- 이상 없음')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write('\n'.join(report) + '\n')
    print(f'회기 {len(out["sessions"])} · 일정 {len(out["events"])} · 점검 {H.status} ({len(H.items)}건) · 새 알림 {len(new)}건')
    return 2 if new else 0

def merge(events, days, ss):
    """당일 자료가 있는 날짜는 계획을 '참고'로 내리고, 계획과 다른 점을 표시"""
    plen = {(e['start'], e['time']) for e in events if e['body'] == '본회의' and e.get('agenda')}
    events[:] = [e for e in events if not (e['body'] == '본회의' and not e.get('agenda') and
                                           any(p[0] == e['start'] for p in plen))]   # 안건 있는 본회의 계획이 있으면 위원회표 줄은 뺀다
    for e in events:
        e['superseded'] = e['start'] == e['end'] and e['start'] in days
    def flat(text):
        return re.sub(r'[\s\-·ㆍ,/οo○◦]', '', text)
    def items(text):
        """'-기관명' 항목만 뽑는다 (쉼표로 이어 쓴 것도 가른다)."""
        out = []
        for l in text.split('\n'):
            if l.strip().startswith('-'):
                out += [flat(x) for x in l.strip()[1:].split(',') if flat(x)]
        return out
    for d, ev in days.items():
        for e in ev:
            plan = [p for p in events if p['start'] == d and p['end'] == d and p['body'] == e['body']
                    and p['source']['type'] == '계획' and not p['minor'] and '자료수집' not in flat(p['text'])]
            e['planned'] = [dict(time=p['time'], text=p['text']) for p in plan]
            pflat = flat(''.join(p['text'] for p in plan)); dflat = flat(e['text'])
            pitems = [x for p in plan for x in items(p['text'])]
            why = []
            if plan:
                gone = [x for x in pitems if x not in dflat]
                new_ = [x for x in items(e['text']) if x not in pflat]
                if gone or new_: why.append('대상 기관')
                ptime = min([p['time'] for p in plan if re.match(r'\d', p['time'])], default='')
                if ptime and re.match(r'\d{1,2}:\d{2}$', e['time']) and e['time'] != ptime: why.append(f'시각 {ptime}→{e["time"]}')
            e['changed'] = why
            e['unplanned'] = not plan and e['body'] != '본회의'
        bodies = {e['body'] for e in ev}
        for p in events:
            if p['start'] == d and p['end'] == d and p['source']['type'] == '계획' and p['body'] not in bodies and not p['minor']:
                p['notInDaily'] = True
        for e in ev:
            s = next((x for x in ss if x['start'] <= d <= x['end']), None)
            e['session'] = s['no'] if s else None; e['superseded'] = False


if __name__ == '__main__':
    sys.exit(main())
