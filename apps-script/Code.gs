/**
 * 전북도의회 의사일정(교육청 관련) — 구글 시트 동기화
 * 웹(GitHub Pages)의 최신 자료(schedule.json)를 읽어 이 시트에 씀. 비밀 키 필요 없음.
 *
 * 시트 공유: 링크가 있는 모든 사용자 — 뷰어 (내부망 파일이 로그인 없이 읽어야 함)
 * 처음 한 번: 확장 프로그램 → Apps Script 에 이 코드 붙여넣기 → setup 실행(권한 허용)
 *   → 30분마다 sync 자동 실행 트리거가 만들어지고 바로 한 번 동기화
 *
 *  _data 탭 : 내부망 파일이 읽는 자료(JSON 을 4만 자씩 나눠 A열에, 각 조각 앞에 '~')
 *  일정 탭  : 사람이 보는 일정표
 *  기록 탭  : 동기화 시각·결과
 */
const SRC = 'https://kain9012-bit.github.io/jbe-council-calendar/data/schedule.json';
const DATA_TAB = '_data';
const CHUNK = 40000;   // 셀 하나 최대 5만 자

function setup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sync').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(30).create();
  sync();
}

function sync() {
  const ss = SpreadsheetApp.getActive();
  const log = sheet_(ss, '기록');
  if (log.getLastRow() === 0) log.appendRow(['동기화 시각', '결과', '자료 수집 시각', '일정 수', '점검']);
  try {
    const res = UrlFetchApp.fetch(SRC + '?v=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
    const d = JSON.parse(res.getContentText('UTF-8'));  // 깨진 자료는 쓰지 않음
    const text = JSON.stringify(d);                   // 들여쓰기 빼서 조각 수 줄임
    if (!d.events || !d.sessions || !d.generated) throw new Error('자료 형식 이상');

    // 1) _data — 조각마다 '~' 를 앞에 붙여 수식·숫자로 바뀌지 않게
    const data = sheet_(ss, DATA_TAB);
    const rows = [['chunk']];
    for (let i = 0; i < text.length; i += CHUNK) rows.push(['~' + text.slice(i, i + CHUNK)]);
    data.clearContents();
    data.getRange(1, 1, rows.length, 1).setNumberFormat('@').setValues(rows);

    // 2) 일정 — 사람이 보는 표: 교육위·본회의·예결특위(교육청 소관·공통)만, 당일 운영상황으로 대체된 계획은 뺌
    const view = sheet_(ss, '일정');
    const head = ['시작일', '종료일', '시각', '회의체', '차수', '내용', '출처', '게시일'];
    const body = d.events.filter(e => !e.superseded && !e.minor && isEdu_(e)).map(e => [
      e.start, e.end, e.time || '', e.body, e.meeting || '', e.text,
      e.source.type === '당일' ? '일일회의운영상황' : '의사일정(안)', e.source.posted]);
    view.clearContents();
    view.getRange(1, 1, body.length + 1, head.length).setNumberFormat('@').setValues([head].concat(body));
    view.setFrozenRows(1);

    log.appendRow([new Date(), '성공', d.generated, d.events.length, (d.health || {}).status || '']);
  } catch (err) {
    log.appendRow([new Date(), '실패: ' + err.message, '', '', '']);
    throw err;                                         // 트리거 실패 메일로 알림
  }
  if (log.getLastRow() > 500) log.deleteRows(2, log.getLastRow() - 500);
}

/** 웹·내부망 파일과 같은 기준 (src/lib/data.ts 의 isEdu) */
function isEdu_(e) {
  if (e.body === '교육위원회' || e.body === '본회의') return true;
  if (e.body !== '예산결산특별위원회') return false;
  if (/교육청|교육감|교육비/.test(e.text)) return true;
  if (/전북특별자치도(?!의회|교육청)|도정|부지사/.test(e.text)) return false;
  return true;
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
