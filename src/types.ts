export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ResultStatus = 'PASS' | 'WARNING' | 'FAIL' | 'BLOCKED' | 'ERROR';

export interface QAConfig {
  baseUrl: string;
  scheduleCron: string;
  parallel: number;
  headless: boolean;
  retentionDays: number;
  requireLogin: boolean;
  login?: {
    path: string;
    idTestId: string;
    pwTestId: string;
    submitTestId: string;
    idEnv: string;
    pwEnv: string;
  };
}

export interface DSLTest {
  id: string;
  category: string;
  type:
    | 'required_field'
    | 'input_validation'
    | 'click_navigation'
    | 'button_disabled'
    | 'double_click_prevention'
    | 'api_call_count'
    | 'text_present'
    | 'element_present';
  steps: Array<Record<string, any>>;
  expect: Record<string, any>;
  severity: Severity;
  evidence?: { screenshotOnFail?: boolean };
}

export interface DSLScreen {
  screen: string;
  path: string;
  preconditions?: { loginRequired?: boolean; role?: string };
  tests: DSLTest[];
}

export interface TestResult {
  runId: string;
  executedAt: string;
  screen: string;
  testId: string;
  status: ResultStatus;
  expected: string;
  actual: string;
  url: string;
  path: string;
  category: string;
  severity: Severity;
  screenshotPath?: string;
  htmlPath?: string;
  tracePath?: string;
  consoleErrorsCount: number;
  consoleWarningsCount?: number;
  networkSummary: string;
  durationMs?: number;
  fingerprint: string;
}
