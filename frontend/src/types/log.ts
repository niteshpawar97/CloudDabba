export interface LogLine {
  type: 'BUILD' | 'RUNTIME' | 'SYSTEM' | 'STATUS';
  message: string;
  timestamp: string;
}
