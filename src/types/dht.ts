/**
 * DHT相关类型定义
 */

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
 * DHT选项接口
 */
export interface DHTOptions {
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
  nodes: Node[];
  listening: boolean;
  destroyed: boolean;
  addNode(node: { host: string; port: number }): void;
  removeNode(id: Buffer): void;
  address(): { address: string; port: number };
  destroy(): void;
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}