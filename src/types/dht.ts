/**
 * DHT相关类型定义
 */

import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';

/**
 * Peer接口
 */
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

/**
 * Node接口 - 继承自Peer
 */
export interface Node extends Peer {
  id: Buffer;
  seen?: number;
}

/**
 * 基础DHT配置接口
 */
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

/**
 * DHT选项接口
 */
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

/**
 * DHT消息接口
 */
export interface DHTMessage {
  t: Buffer;
  y: string;
  q: string;
  a: {
    id: Buffer;
    target: Buffer;
  };
}

/**
 * DHT回复接口
 */
export interface DHTReply {
  r?: {
    nodes?: Buffer;
  };
}

/**
 * 启动事件接口
 */
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

/**
 * DHT管理器配置接口
 */
export interface DHTManagerConfig {
  address?: string;
  port?: number;
  bootstrap?: boolean | string[];
  nodesMaxSize: number;
  refreshPeriod: number;
  announcePeriod: number;
  enableMemoryMonitoring?: boolean;
  memoryThreshold?: number;
  cleanupInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultInfoHash?: string;
  defaultPort?: number;
}

/**
 * DHT管理器扩展配置接口
 */
export interface DHTManagerExtendedConfig extends DHTManagerConfig, Omit<DHTOptions, 'bootstrap'> {}

/**
 * Peer管理器配置接口
 */
export interface PeerManagerConfig {
  maxNodes: number;
  nodeRefreshTime: number;
  findNodeProbability: number;
  enableMemoryMonitoring?: boolean;
  memoryThreshold?: number;
  cleanupInterval?: number;
  maxNodeAge?: number;
}

/**
 * DHT类接口（用于类型声明）
 */
export interface DHTInstance {
  nodeId: Buffer;
  nodes: any;
  listening: boolean;
  destroyed: boolean;
  addNode(node: { host: string; port: number }): void;
  removeNode(id: Buffer): void;
  address(): { address: string; port: number };
  destroy(): void;
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}