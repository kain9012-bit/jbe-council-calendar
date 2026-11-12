"""한글 문서(HWP 5.0 / HWPX)를 '표 칸 단위'로 읽는다.

반환: [{"type":"para","text":..} | {"type":"table","cells":[{row,col,rowspan,colspan,text}]}]
도의회 첨부는 확장자가 .hwp 여도 속은 HWPX(zip)인 경우가 있어 내용으로 판별한다.
"""
import re, struct, zipfile, zlib, html

def read(path):
    with open(path, 'rb') as f:
        head = f.read(4)
    if head[:2] == b'PK':
        return _hwpx(path)
    return _hwp5(path)

# ---------- HWPX ----------
def _hwpx(path):
    z = zipfile.ZipFile(path)
    secs = sorted([n for n in z.namelist() if re.match(r'Contents/section\d+\.xml', n)],
                  key=lambda n: int(re.findall(r'\d+', n)[0]))
    out = []
    for n in secs:
        x = z.read(n).decode('utf-8')
        pos = 0
        for m in re.finditer(r'<hp:tbl\b.*?</hp:tbl>', x, re.S):
            out += _hwpx_paras(x[pos:m.start()])
            cells = []
            for tc in re.finditer(r'<hp:tc\b.*?</hp:tc>', m.group(0), re.S):
                t = tc.group(0)
                a = re.search(r'<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"', t)
                s = re.search(r'<hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"', t)
                cells.append(dict(col=int(a.group(1)), row=int(a.group(2)),
                                  colspan=int(s.group(1)) if s else 1, rowspan=int(s.group(2)) if s else 1,
                                  text='\n'.join(p['text'] for p in _hwpx_paras(t))))
            out.append({'type': 'table', 'cells': cells})
            pos = m.end()
        out += _hwpx_paras(x[pos:])
    return out

def _hwpx_paras(x):
    res = []
    for p in re.findall(r'<hp:p\b.*?</hp:p>', x, re.S):
        t = html.unescape(''.join(re.findall(r'<hp:t>([^<]*)</hp:t>', p)))
        res.append({'type': 'para', 'text': t})
    return res

# ---------- HWP 5.0 ----------
TAG_PARA_TEXT, TAG_CTRL_HEADER, TAG_LIST_HEADER = 67, 71, 72

def _hwp5(path):
    import olefile
    o = olefile.OleFileIO(path)
    comp = o.openstream('FileHeader').read()[36] & 1
    secs = sorted([e for e in o.listdir() if e[0] == 'BodyText'], key=lambda e: int(e[1][7:]))
    out = []
    for e in secs:
        d = o.openstream(e).read()
        if comp:
            d = zlib.decompress(d, -15)
        table = None; tbl_level = None; cell = None
        i = 0
        while i < len(d):
            h = struct.unpack('<I', d[i:i+4])[0]; i += 4
            tag, lvl, sz = h & 0x3ff, (h >> 10) & 0x3ff, h >> 20
            if sz == 0xfff:
                sz = struct.unpack('<I', d[i:i+4])[0]; i += 4
            rec = d[i:i+sz]; i += sz
            if table is not None and lvl <= tbl_level:
                out.append({'type': 'table', 'cells': table}); table = None; cell = None
            if tag == TAG_CTRL_HEADER and rec[:4] == b' lbt' and table is None:
                table, tbl_level = [], lvl
            elif tag == TAG_LIST_HEADER and table is not None and len(rec) >= 16:
                col, row, cs, rs = struct.unpack('<HHHH', rec[8:16])
                cell = dict(col=col, row=row, colspan=cs, rowspan=rs, text='')
                table.append(cell)
            elif tag == TAG_PARA_TEXT:
                t = _para_text(rec)
                if table is not None and cell is not None:
                    cell['text'] = (cell['text'] + '\n' + t) if cell['text'] else t
                elif table is None:
                    out.append({'type': 'para', 'text': t})
        if table is not None:
            out.append({'type': 'table', 'cells': table})
    return out

def _para_text(rec):
    s = []; j = 0
    while j + 1 < len(rec):
        c = struct.unpack('<H', rec[j:j+2])[0]
        if c in (1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23):
            j += 16; continue          # 확장/인라인 컨트롤 (8 글자 분량)
        if c == 9: s.append('\t')
        elif c >= 32: s.append(chr(c))
        j += 2
    return ''.join(s)

def grid(cells):
    """칸 목록 → {(row,col): text}, 병합 칸은 덮는 모든 자리에 같은 글을 둔다."""
    g = {}
    for c in cells:
        for r in range(c['row'], c['row'] + c['rowspan']):
            for k in range(c['col'], c['col'] + c['colspan']):
                g[(r, k)] = c['text']
    return g
