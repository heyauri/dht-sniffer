/**
 * 元数据相关类型定义
 */

/**
 * 元数据获取目标接口
 */
export interface MetadataFetchTarget {
  infoHash: Buffer;
  peer: Peer;
}

/**
 * 元数据获取配置接口
 */
export interface MetadataFetchConfig {
  downloadMaxTime?: number;
}

/**
 * 元数据信息接口
 */
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

/**
 * 解析后的元数据接口
 */
export interface ParsedMetadata {
  infoHash: Buffer;
  name: string;
  size: number;
  torrentType: 'single' | 'multiple';
  filePaths: string[] | string;
  info: MetadataInfo;
  rawMetadata: Buffer;
}

/**
 * 元数据接口
 */
export interface Metadata {
  infoHash: Buffer;
  name: string;
  size: number;
  torrentType: 'single' | 'multiple';
  filePaths: string[];
  info: MetadataInfo;
  rawMetadata: Buffer;
  timestamp: number;
  peer?: Peer;
}

/**
 * 元数据错误接口
 */
export interface MetadataError {
  infoHash: Buffer;
  error: Error | string;
  timestamp?: number;
  retryCount?: number;
}

/**
 * 元数据警告接口
 */
export interface MetadataWarning {
  type: 'metadataWarning';
  err: Error | string;
  infoHash?: Buffer;
  peer?: Peer;
}

/**
 * 等待队列项接口
 */
export interface WaitingQueueItem {
  infoHash: Buffer;
  peer: Peer;
  infoHashStr: string;
}

/**
 * 元数据等待项接口
 */
export interface MetadataWaitingItem {
  infoHash: Buffer;
  peer: Peer;
  infoHashStr: string;
}

/**
 * 元数据统计信息接口
 */
export interface MetadataStats {
  fetchingNum: number;
  metadataWaitingQueueSize: number;
  uniqueWaitingKeys: number;
  activeFetchingCount: number;
  totalFetchCount: number;
  successFetchCount: number;
  failedFetchCount: number;
  successRate: number;
  uptime: number;
  aggressiveLimit: number;
}

/**
 * 元数据管理器配置接口
 */
export interface MetadataManagerConfig {
  maximumParallelFetchingTorrent: number;
  maximumWaitingQueueSize: number;
  downloadMaxTime: number;
  ignoreFetched: boolean;
  aggressiveLevel: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffFactor?: number;
  enablePerformanceMonitoring?: boolean;
  performanceMonitoringInterval?: number;
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  enableMemoryOptimization?: boolean;
  memoryCleanupThreshold?: number;
}

// 导入Peer类型
import { Peer } from './dht';