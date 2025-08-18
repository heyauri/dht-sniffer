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

export interface DHTOptions {
    port?: number;
    refreshTime?: number;
    maximumParallelFetchingTorrent?: number;
    maximumWaitingQueueSize?: number;
    downloadMaxTime?: number;
    expandNodes?: boolean;
    ignoreFetched?: boolean;
    concurrency?: number;
    fetchedTupleSize?: number;
    fetchedInfoHashSize?: number;
    findNodeCacheSize?: number;
    aggressiveLevel?: number;
    bootstrap?: boolean | string[];
    maxTables?: number;
    maxValues?: number;
    maxPeers?: number;
    maxAge?: number;
    timeBucketOutdated?: number;
    enhanceBootstrap?: boolean;
    bootstrapNodes?: Node[];
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

export interface Sizes {
    fetchingNum: number;
    metadataWaitingQueueSize: number;
    uniqueWaitingKeys: number;
    fetchedTupleSize: number;
    fetchedInfoHashSize: number;
    fetchedTupleHit: number;
    fetchedInfoHashHit: number;
    metadataFetchingCacheSize: number;
    rpcPendingSize: number;
    nodeListSize: number;
    runTime: string;
}

export interface WaitingQueueItem {
    infoHash: Buffer;
    peer: Peer;
    infoHashStr: string;
}

export interface Counter {
    fetchedTupleHit: number;
    fetchedInfoHashHit: number;
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

export interface StartEvent {
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

export interface TimeoutError {
    type: 'timeout';
    err?: Error | string;
    operation?: string;
    timeoutMs?: number;
    peer?: Peer;
}

export type FetchError = MetadataWarning | SocketError | TimeoutError;

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

// 导出错误处理和监控模块
export * from '../utils/error-handler';
export { ErrorMonitor, ErrorMonitorConfig } from '../utils/error-monitor';