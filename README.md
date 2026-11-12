# 도의회 회의운영 달력 (jbe-council-calendar)

전북특별자치도의회 회기·본회의·위원회 일정을 달력으로 보는 비공식 업무지원 화면.
교육청 직원 기준(교육위·본회의·예결특위)이 기본 보기, 「전체 회의」로 전환 가능.

## 자료 출처 (도의회 누리집, 인증 없음)
| 구분 | 주소 | 내용 | 갱신 |
|---|---|---|---|
| 회기 | /jbassem/scheduleMonth (화면 안 events 배열) | 회기 시작·끝, 다음 해 회기운영계획 | 연 1회 + 변경 시 |
| 의사일정(안) | /jbassem/board/23 → 한글 첨부 | 회기별 상임위·예결특위·본회의 날짜별 계획 | 회기 직전, 재게시 있음 |
| 일일회의운영상황 | /jbassem/board/24 → 한글 첨부 | 그날 실제 운영 | 회의 날 아침 |

- FullCalendar `end` 는 마지막 날 다음날 → 수집기에서 하루 뺌
- 첨부는 확장자가 .hwp 여도 속이 HWPX(zip)인 경우 있음 → `collector/hwpread.py` 가 내용으로 판별
- 한글 표는 칸(행·열·병합) 단위로 읽음. 위원회 칸 3개 이상 병합 = 본회의 등 전체 일정

## 우선 규칙
- 같은 날 일일회의운영상황이 있으면 그것이 정답, 계획(안)은 `superseded`
- 같은 회기 의사일정(안)이 다시 올라오면 최신 글만
- 계획과 당일의 '-기관' 항목·시작 시각이 다르면 `changed` (예: 11.12 농업복지환경위 10:00→09:30)
- 문구는 원문 그대로(원문 오탈자 포함)

## 깨졌을 때 (수집 점검)
`collect.py` 종료코드 0 정상 · 1 확인 필요 · 2 실패. 결과는 `public/data/health.json` 과 schedule.json 의 `health`, 화면 맨 위 안내 띠·「자료 출처·한계」에 표시.

| 상황 | 감지 | 처리 |
|---|---|---|
| 누리집 개편(회기 못 찾음) | 회기 0건 | 실패 · 일정 전체 직전 정상본 유지 |
| 게시판 목록 구조 변경 | 글 0건 | 실패 · 그 출처 일정 직전 정상본 유지 |
| 한글 서식 변경 | 문서 1건 일정 0건, 낯선 회의체 이름 | 확인 필요 · 그 글만 직전 정상본, 새 글이면 「원문 확인」 안내 |
| 회기 변경 | 달력 기간 ≠ 문서 머리 기간 | 확인 필요 |
| 일부 누락 | 출처별 일정 수 30% 넘게 감소 | 확인 필요 |
| 수집 작업 멈춤 | 마지막 정상 수집 36시간 초과 | 화면 안내 띠 |

수집기를 고친 뒤에는 반드시 `python collector/selftest.py` — 받아 둔 문서 47건을 다시 읽어 기준값(`collector/fixtures.json`)과 비교. 예전 문서 결과가 바뀌면 종료코드 1. 새 결과가 맞다고 확인했을 때만 `--update`.

## OpenRouter 대신 읽기
- 규칙으로 일정이 0건 나온 **처음 보는 글**만 `collector/ai_read.py` 가 OpenRouter 로 읽음 (같은 글은 직전 정상본 사용)
- 결과 검증: 회기 기간(앞뒤 7일) 안 날짜, '위원회·본회의' 꼴 회의체, 내용 있음 — 통과분만 반영
- 키: 환경변수 `OPENROUTER_API_KEY`, 모델: `OPENROUTER_MODEL`(기본 google/gemini-2.5-flash). 키 없으면 건너뜀
- AI 가 메운 날도 알림 대상 — 규칙 수집기는 직접 고침

## 자동 수집·알림 (.github/workflows/collect.yml)
- 평일 08:40·09:40·10:40·13:40·17:40, 주말 10:40 (한국 시각) 수집 → 자료 커밋 → 빌드 → GitHub Pages 반영
- 새로 생긴 수집 문제(종료코드 2) 또는 회귀 시험 실패 → 마지막 `alert` 단계 실패 → GitHub 실패 알림 메일. 같은 문제는 다음 실행부터 다시 알리지 않음
- 저장소 설정 필요: Secrets `OPENROUTER_API_KEY`, (선택) Variables `OPENROUTER_MODEL`, Pages 원본 = GitHub Actions, 개인 설정 Notifications → Actions 실패 메일 켜기

## 내부망용 단일 파일 + 구글 시트
- 웹(GitHub Pages)은 저장소의 `data/schedule.json` 을 읽음. 구글 시트는 내부망 파일 전용
- 구글 시트: `apps-script/Code.gs` 가 30분마다 웹의 schedule.json 을 시트로 옮김(덮어쓰기)
  - `_data` 탭: JSON 4만 자 조각(앞에 `~`) — 내부망 파일이 읽음 / `일정` 탭: 사람이 보는 표 / `기록` 탭: 동기화 기록
  - 시트 공유: 링크가 있는 모든 사용자 — 뷰어
- 내부망 파일: 열 때 구글 시트(gviz JSONP)에서 최신 자료를 읽음. 실패하면 파일에 담긴 자료 + 안내 띠. 시트 외 바깥 호출 없음
- 시트 ID: `src/config.ts` 의 `SHEET_ID`
- `npm run build` → `release/도의회_회의운영_달력_YYYYMMDD.html`, 웹의 「내부망용 파일 받기」도 같은 파일

## 실행
```
python collector/collect.py      # public/data/schedule.json 갱신 (olefile 필요: pip install olefile)
npm install && npm run dev       # 화면 확인
npm run build                    # dist/ 생성 (base './' — 하위 경로 배포 가능)
```
환경변수: `JBC_SINCE`(기본 429, 13대 첫 회기), `JBC_DAILY_PAGES`(기본 3쪽 ≈ 36일)

## 구조
- `collector/collect.py` 수집·병합 / `collector/hwpread.py` 한글(HWP5·HWPX) 표 읽기
- `src/` 화면 — 틀은 jbe-staff-tools-board `Shell.tsx`(누리집 틀) 기준
- `cache/` 받은 첨부(글 번호별, 다시 받지 않음) — 저장소에 올리지 않음
