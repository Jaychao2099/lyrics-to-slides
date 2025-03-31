/// <reference types="node" />
/// <reference types="electron" />

import { ElectronAPI } from './common/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 