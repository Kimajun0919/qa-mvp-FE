import { chatJson, type LLMOptions } from './client.js';

export type QAChecklistRow = {
  화면: string;
  구분: string;
  테스트시나리오: string;
  확인: string;
};

export async function generateQAChecklist(
  input: {
    screen: string;
    context?: string;
    includeAuth?: boolean;
  },
  llmOptions?: LLMOptions,
): Promise<{ mode: 'llm' | 'heuristic'; rows: QAChecklistRow[]; reason?: string }> {
  const prompt = `너는 웹사이트 QA 테스트 전문가다.
[목적]
- PM/QA가 실제 운영 전 검수에 사용하는 실무용 QA 시트
- 퍼블리싱 + 기능 + 유효성 + 예외 케이스까지 포함
- 특정 화면 하나를 기준으로 꼼꼼하게 QA 가능하도록 구성

[시트 컬럼 구성 – 반드시 이 순서로]
1. 화면
2. 구분
3. 테스트시나리오
4. 확인

[작성 규칙]
- 결과는 하나의 표(table)로만 출력할 것
- 엑셀/구글시트에 그대로 복붙 가능해야 함
- 불필요한 설명 문장 없이 표만 출력
- “확인” 컬럼은 비워두고 체크용으로 남길 것
- 테스트시나리오는 실제 QA가 수행하는 행동 기준으로 작성
- 한 행당 하나의 테스트 포인트만 작성
- 모호한 표현 금지

[구분 항목 가이드]
- 퍼블리싱
- 반응형
- 입력폼
- 유효성 검사
- 기능 동작
- 상태값
- 예외/보안

[반드시 포함할 공통 테스트 관점]
- 필수값 누락 시 처리
- 에러 메시지 위치/문구 명확성
- 중복 클릭/중복 요청 방지
- 모바일 키보드 노출 시 화면 가림
- 새로고침/뒤로가기 시 데이터 처리
- 비로그인 접근 제어 (해당 시)
- 상태값/안내 문구 일관성

입력 화면: ${input.screen}
추가 컨텍스트: ${input.context || '(없음)'}
비로그인 접근 제어 포함 여부: ${input.includeAuth ? '포함' : '미포함'}

반드시 JSON만 반환:
{"rows":[{"화면":"...","구분":"...","테스트시나리오":"...","확인":""}]}`;

  try {
    const r = await chatJson({
      system: 'Return strict JSON only.',
      user: prompt,
      options: { temperature: 0.2, ...llmOptions },
    });
    if (!r.ok) throw new Error(r.error);
    const parsed = JSON.parse(r.content || '{}');
    const rows: QAChecklistRow[] = (parsed?.rows || []).map((r: any) => ({
      화면: String(r?.화면 || input.screen),
      구분: String(r?.구분 || ''),
      테스트시나리오: String(r?.테스트시나리오 || ''),
      확인: '',
    }));
    if (!rows.length) throw new Error('empty rows');
    return { mode: 'llm', rows };
  } catch (e: any) {
    return { mode: 'heuristic', rows: heuristicRows(input), reason: e?.message || 'llm error' };
  }
}

function heuristicRows(input: { screen: string; includeAuth?: boolean }): QAChecklistRow[] {
  const s = input.screen;
  const rows: QAChecklistRow[] = [
    { 화면: s, 구분: '퍼블리싱', 테스트시나리오: '헤더/본문/푸터 레이아웃이 1920px 기준에서 겹치지 않고 정렬이 유지된다.', 확인: '' },
    { 화면: s, 구분: '반응형', 테스트시나리오: '모바일(390px)에서 주요 CTA 버튼이 첫 화면 내 노출되고 가로 스크롤이 발생하지 않는다.', 확인: '' },
    { 화면: s, 구분: '입력폼', 테스트시나리오: '필수 입력 항목을 모두 비운 상태로 제출하면 제출이 차단된다.', 확인: '' },
    { 화면: s, 구분: '유효성 검사', 테스트시나리오: '이메일 필드에 잘못된 형식 입력 후 포커스 아웃 시 오류 문구가 필드 인접 위치에 표시된다.', 확인: '' },
    { 화면: s, 구분: '기능 동작', 테스트시나리오: '주요 CTA 클릭 시 의도된 다음 URL로 3초 이내 이동한다.', 확인: '' },
    { 화면: s, 구분: '상태값', 테스트시나리오: '로딩 상태에서 로딩 인디케이터가 노출되고 완료 후 즉시 숨김 처리된다.', 확인: '' },
    { 화면: s, 구분: '예외/보안', 테스트시나리오: '제출 버튼을 3회 연속 빠르게 클릭해도 중복 요청이 1회만 발생한다.', 확인: '' },
    { 화면: s, 구분: '예외/보안', 테스트시나리오: '입력 도중 새로고침 후 재진입 시 데이터 보존/초기화 정책이 설계 의도와 일치한다.', 확인: '' },
    { 화면: s, 구분: '반응형', 테스트시나리오: '모바일 키보드 노출 시 활성 입력창과 제출 버튼이 키보드에 가려지지 않는다.', 확인: '' },
    { 화면: s, 구분: '상태값', 테스트시나리오: '실패/성공 안내 문구가 동일 톤&용어로 일관되게 표시된다.', 확인: '' },
  ];

  if (input.includeAuth) {
    rows.push({ 화면: s, 구분: '예외/보안', 테스트시나리오: '비로그인 상태로 화면 URL 직접 접근 시 로그인 페이지로 리다이렉트된다.', 확인: '' });
  }
  return rows;
}

export function checklistToTsv(rows: QAChecklistRow[]) {
  const header = ['화면', '구분', '테스트시나리오', '확인'];
  const lines = [header.join('\t')].concat(rows.map((r) => [r.화면, r.구분, r.테스트시나리오, r.확인].join('\t')));
  return lines.join('\n');
}
