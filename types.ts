
export interface TranscriptionLine {
  id: string;
  text: string;
  type: 'user' | 'oracle';
}

export enum OracleStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  LISTENING = 'listening',
  ERROR = 'error'
}
