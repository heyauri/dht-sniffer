export interface Peer {
    host: string;
    port: number;
    address?: string;
    family?: 'IPv4' | 'IPv6';
    size?: number;
    id?: Buffer;
    distance?: number;
    token?: string | null;
}

// 导入协议扩展类型
export * from './protocol-extensions';

export interface Node extends Peer {
    id: Buffer;
    seen?: number;
}

// 基础DHT配置接口
export interface BaseDHTConfig {
    port?: number;
    refreshTime?: number;
    downloadMaxTime?: number;
    expandNodes?: boolean;
    ignoreFetched?: boolean;
    concurrency?: number;
    fetchedTupleSize?: number;
    fetchedInfoHashSize?: number;
    findNodeCacheSize?: number;
    aggressiveLevel?: number;
    enhanceBootstrap?: boolean;
    bootstrapNodes?: Node[];
}

export interface DHTOptions extends BaseDHTConfig {
    maximumParallelFetchingTorrent?: number;
    maximumWaitingQueueSize?: number;
    bootstrap?: boolean | string[];
    maxTables?: number;
    maxValues?: number;
    maxPeers?: number;
    maxAge?: number;
    timeBucketOutdated?: number;
}

export interface MetadataFetchTarget {
    infoHash: Buffer;
    peer: Peer;
}

export interface MetadataFetchConfig {
    downloadMaxTime?: number;
}

export interface ParsedMetadata {
    infoHash: Buffer;
    name: string;
    size: number;
    torrentType: 'single' | 'multiple';
    filePaths: string[] | string;
    info: MetadataInfo;
    rawMetadata: Buffer;
}

export interface MetadataInfo {
    length?: number;
    files?: Array<{
        length: number;
        path: string[];
    }>;
    name?: string;
    pieceLength?: number;
    pieces?: Buffer;
    private?: boolean;
    [key: string]: unknown;
}

export interface MetadataError {
    infoHash: Buffer;
    error: Error | string;
    timestamp?: number;
    retryCount?: number;
}



export interface WaitingQueueItem {
    infoHash: Buffer;
    peer: Peer;
    infoHashStr: string;
}



export interface DHTMessage {
    t: Buffer;
    y: string;
    q: string;
    a: {
        id: Buffer;
        target: Buffer;
    };
}

export interface DHTReply {
    r?: {
        nodes?: Buffer;
    };
}

export interface StartEvent extends BaseDHTConfig {
    startTime: number;
    port: number;
    refreshTime: number;
    maximumParallelFetchingTorrent: number;
    maximumWaitingQueueSize: number;
    downloadMaxTime: number;
    expandNodes: boolean;
    ignoreFetched: boolean;
    concurrency: number;
    fetchedTupleSize: number;
    fetchedInfoHashSize: number;
    findNodeCacheSize: number;
    aggressiveLevel: number;
}

export interface MetadataWarning {
    type: 'metadataWarning';
    err: Error | string;
    infoHash?: Buffer;
    peer?: Peer;
}

export interface SocketError {
    type: 'socketError';
    err?: Error | string;
    hadError?: boolean;
    peer?: Peer;
    operation?: 'connect' | 'read' | 'write';
}

export interface TimeoutErrorInfo {
    type: 'timeout';
    err?: Error | string;
    operation?: string;
    timeoutMs?: number;
    peer?: Peer;
}

export type FetchError = MetadataWarning | SocketError | TimeoutErrorInfo;

// 错误处理相关类型
export interface ErrorStats {
    totalErrors: number;
    errorRate: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: any[];
    lastErrorTime: number;
    firstErrorTime: number;
    consecutiveErrors: number;
}

export interface ErrorAlert {
    type: 'highErrorRate' | 'criticalError' | 'consecutiveErrors';
    message: string;
    timestamp: number;
    severity: 'warning' | 'error' | 'critical';
    data?: any;
}

export interface ErrorRecovery {
    consecutiveErrors: number;
    recoveryTime: number;
    timestamp: number;
}

export interface ErrorTrend {
    timestamp: number;
    errorCount: number;
    errorRate: number;
}

// 统一事件类型定义
export interface dhtevent {
  type: 'node' | 'peer' | 'infohash' | 'error' | 'warning' | 'started' | 'stopped' | 'metadata' | 'metadataerror';
  timestamp: number;
  data: any;
}

export interface nodeevent extends dhtevent {
  type: 'node';
  data: {
    node: Node;
  };
}

export interface peerevent extends dhtevent {
  type: 'peer';
  data: {
    peer: Peer;
    infohash: Buffer;
  };
}

export interface infohashevent extends dhtevent {
  type: 'infohash';
  data: {
    infohash: Buffer;
    peer: Peer;
  };
}

export interface errorevent extends dhtevent {
  type: 'error';
  data: {
    error: Error;
    source?: string;
  };
}

export interface warningevent extends dhtevent {
  type: 'warning';
  data: {
    message: string;
    source?: string;
  };
}

export interface statusevent extends dhtevent {
  type: 'started' | 'stopped';
  data: {
    timestamp: number;
    status: 'started' | 'stopped';
  };
}

export interface metadataevent extends dhtevent {
  type: 'metadata';
  data: {
    infohash: Buffer;
    metadata: ParsedMetadata;
  };
}

export interface metadataerrorevent extends dhtevent {
  type: 'metadataerror';
  data: {
    infohash: Buffer;
    error: Error | string;
    peer?: Peer;
    retrycount?: number;
  };
}

export type dhteventtype = nodeevent | peerevent | infohashevent | errorevent | warningevent | statusevent | metadataevent | metadataerrorevent;

// 导出错误处理和监控模块
export * from '../utils/error-handler';
export { ErrorMonitor, ErrorMonitorConfig } from '../utils/error-monitor';