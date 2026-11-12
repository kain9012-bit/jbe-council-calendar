"""규칙으로 못 읽은 한글 문서를 OpenRouter 로 대신 읽기.

OPENROUTER_API_KEY 가 없으면 아무것도 하지 않는다(빈 목록).
결과는 검증(날짜 범위·회의체 이름·내용)을 통과한 것만 돌려준다.
"""
import json, os, re, urllib.request, datetime as dt
import hwpread

API = 'https://openrouter.ai/api/v1/chat/completions'
MODEL = os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash')
BODY_OK = re.compile(r'(위원회|본회의|개원식|간담회)$')

def doc_text(path, limit=24000):
    """표는 칸 위치를 살려 '행 n: 칸 | 칸' 꼴로 펼친다."""
    out = []
    for b in hwpread.read(path):
        if b['type'] == 'para':
            if b['text'].strip(): out.append(b['text'].strip())
            continue
        g = hwpread.grid(b['cells'])
        R = max(r for r, c in g) + 1; C = max(c for r, c in g) + 1
        out.append('[표]')
        for r in range(R):
            cells = [g.get((r, c), '').replace('\n', ' / ').strip() for c in range(C)]
            out.append(f'행{r}: ' + ' | '.join(cells))
        out.append('[표 끝]')
    return '\n'.join(out)[:limit]

PROMPT = """아래는 전북특별자치도의회 {kind} 한글 문서를 글자로 풀어 쓴 것이다.
회의 일정을 빠짐없이 JSON 으로 뽑아라. 문서에 없는 내용은 지어내지 마라. 문구는 원문 그대로 쓴다.

형식: {{"events":[{{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","time":"HH:MM 또는 원문의 시각 표현 또는 빈 문자열","body":"회의체 이름(예: 교육위원회, 본회의, 예산결산특별위원회)","meeting":"차수(예: 제1차) 또는 빈 문자열","text":"내용, 줄바꿈은 \\n, 대상 기관은 '-기관명' 줄로"}}]}}
- 연도가 없는 날짜는 {year}년으로 본다. 기간이 아닌 하루 일정은 start=end.
- 한 칸에 시각이 여럿이면 시각마다 따로 한 건.
- 의정활동자료수집처럼 회의가 아닌 날도 원문대로 넣는다.

문서:
{text}"""

def call(prompt, key):
    req = urllib.request.Request(API, data=json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'response_format': {'type': 'json_object'},
        'temperature': 0,
    }).encode(), headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                          'X-Title': 'jbe-council-calendar'})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode())
    txt = res['choices'][0]['message']['content']
    txt = re.sub(r'^```(?:json)?|```$', '', txt.strip(), flags=re.M)
    return json.loads(txt)

def validate(items, lo, hi, src, minor_words):
    """회기 기간(앞뒤 7일 여유) 안의 날짜, 아는 꼴의 회의체 이름, 내용 있는 것만."""
    out = []
    lo = (dt.date.fromisoformat(lo) - dt.timedelta(days=7)).isoformat()
    hi = (dt.date.fromisoformat(hi) + dt.timedelta(days=7)).isoformat()
    for e in items or []:
        try:
            s = dt.date.fromisoformat(str(e.get('start'))).isoformat()
            en = dt.date.fromisoformat(str(e.get('end') or s)).isoformat()
        except ValueError:
            continue
        body = str(e.get('body', '')).strip(); text = str(e.get('text', '')).strip()
        if not (lo <= s <= en <= hi) or not BODY_OK.search(body) or not text:
            continue
        flat = text.replace(' ', '')
        out.append(dict(start=s, end=en, time=str(e.get('time', '')).strip(), body=body,
                        meeting=str(e.get('meeting', '')).strip(), text=text, source=src,
                        minor=('자료수집' in re.sub(r'[·ㆍ‧,/]', '', flat) and not any(l.strip().startswith('-') for l in text.split('\n'))), via='ai'))
    return out

def read(path, kind, year, src, lo, hi, minor_words=('자료수집',), caller=None):
    key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if not key:
        return [], 'OPENROUTER_API_KEY 없음'
    try:
        res = (caller or call)(PROMPT.format(kind=kind, year=year, text=doc_text(path)), key)
    except Exception as e:
        return [], f'OpenRouter 호출 실패 ({type(e).__name__}: {e})'
    ev = validate(res.get('events') if isinstance(res, dict) else None, lo, hi, src, minor_words)
    return ev, '' if ev else '검증 통과 0건'
