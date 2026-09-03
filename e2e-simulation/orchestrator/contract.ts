export interface ExpectedEventContract {
  test_id: string;
  actor: string;
  input_url: string;
  expected: {
    navigation: boolean;
    scan: boolean;
    verdict: 'SAFE' | 'WARN' | 'BLOCK' | 'SCAN_INCOMPLETE' | 'ERROR';
    security_event: boolean;
    manager_visibility: boolean;
    admin_visibility: boolean;
  };
}

export interface ContractResult {
  test_id: string;
  navigation: boolean;
  extension: boolean;
  scan: boolean;
  verdict: boolean;
  security_event: boolean;
  db_persistence: boolean;
  manager_visibility: boolean;
  admin_visibility: boolean;
  overall: boolean;
}
