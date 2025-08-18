import { EventEmitter } from 'events';
import * as metadataHelper from '../metadata/metadata-helper';
import * as utils from '../utils';
import { NetworkError, TimeoutError, MetadataError, ErrorHandler } from '../utils/error-handler';

/**
 * 元数据等待项
 */
export interface MetadataWaitingItem {
  infoHash: Buffer;
  peer: any;
  infoHashStr: string;
}

/**
 * 元数据管理器配置
 */
export interface MetadataManagerConfig {
  maximumParallelFetchingTorrent: number;
  maximumWaitingQueueSize: number;
  downloadMaxTime: number;
  ignoreFetched: boolean;
  aggressiveLevel: number;
}

/**
 * 元数据管理器 - 负责管理元数据获取逻辑
 */
export class MetadataManager extends EventEmitter {
  private config: MetadataManagerConfig;
  private errorHandler: ErrorHandler;
  private cacheManager: any;
  private metadataWaitingQueues: MetadataWaitingItem[];
  private metadataFetchingDict: Record<string, number>;
  private aggressiveLimit: number;
  
  constructor(config: MetadataManagerConfig, errorHandler: ErrorHandler, cacheManager: any) {
    super();
    this.config = config;
    this.errorHandler = errorHandler;
    this.cacheManager = cacheManager;
    
    this.metadataWaitingQueues = [];
    this.metadataFetchingDict = {};
    
    const aggressiveLevel = config.aggressiveLevel;
    this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0 
      ? aggressiveLevel * config.maximumParallelFetchingTorrent 
      : 0;
  }
  
  /**
   * 添加元数据到等待队列
   */
  addQueuingMetadata(infoHash: Buffer, peer: any, reverse = false): void {
    const arr = this.metadataWaitingQueues;
    const infoHashStr = infoHash.toString('hex');
    const obj: MetadataWaitingItem = { infoHash, peer, infoHashStr };
    
    reverse ? arr.unshift(obj) : arr.push(obj);
    
    if (this.config.maximumWaitingQueueSize > 0 && arr.length > this.config.maximumWaitingQueueSize) {
      arr.shift();
    }
    
    this.dispatchMetadata();
    this.boostMetadataFetching();
  }
  
  /**
   * 分发元数据获取任务
   */
  private dispatchMetadata(): void {
    const fetchings = Object.keys(this.metadataFetchingDict);
    
    if (fetchings.length >= this.config.maximumParallelFetchingTorrent) {
      return;
    }
    
    const nextFetching = this.metadataWaitingQueues.pop();
    if (!nextFetching) return;
    
    const { infoHash, infoHashStr, peer } = nextFetching;
    const nextFetchingKey = this.getNextFetchingKey(nextFetching);
    
    // 检查是否正在获取相同的infohash
    if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
      if (this.aggressiveLimit > 0 && this.aggressiveLimit > fetchings.length) {
        // AGGRESSIVE CHOICE: 继续获取这个元数据
      } else {
        this.metadataWaitingQueues.unshift(nextFetching);
        
        // 防止重复infohash的无限分发
        const metadataFetchingCache = this.cacheManager.getMetadataFetchingCache();
        if (!metadataFetchingCache.get(infoHashStr)) {
          metadataFetchingCache.set(infoHashStr, 1);
          this.dispatchMetadata();
        }
        return;
      }
    }
    
    // 检查是否已经获取过
    const fetchedTuple = this.cacheManager.getFetchedTuple();
    const fetchedInfohash = this.cacheManager.getFetchedInfoHash();
    
    if (this.config.ignoreFetched && fetchedTuple.get(nextFetchingKey)) {
      this.cacheManager.incrementFetchedTupleHit();
      this.dispatchMetadata();
      return;
    }
    
    if (this.config.ignoreFetched && fetchedInfohash.get(infoHashStr)) {
      this.cacheManager.incrementFetchedInfoHashHit();
      this.dispatchMetadata();
      return;
    }
    
    // 记录获取状态
    if (!this.metadataFetchingDict[infoHashStr]) {
      this.metadataFetchingDict[infoHashStr] = 1;
    } else if (this.aggressiveLimit > 0) {
      this.metadataFetchingDict[infoHashStr] += 1;
    }
    
    fetchedTuple.set(nextFetchingKey, 1);
    
    // 执行获取
    this.fetchMetadata(infoHash, peer, infoHashStr);
  }
  
  /**
   * 执行元数据获取
   */
  private fetchMetadata(infoHash: Buffer, peer: any, infoHashStr: string): void {
    const _this = this;
    
    metadataHelper
      .fetch({ infoHash, peer }, this.config)
      .then(metadata => {
        if (metadata === undefined) return;
        
        _this.emit('metadata', { infoHash, metadata });
        
        const fetchedInfohash = _this.cacheManager.getFetchedInfoHash();
        const usefulPeers = _this.cacheManager.getUsefulPeers();
        
        fetchedInfohash.set(infoHashStr, 1);
        usefulPeers.set(`${peer.host}:${peer.port}`, peer);
        
        if (_this.config.ignoreFetched) {
          _this.removeDuplicatedWaitingObjects(infoHashStr);
        }
      })
      .catch(error => {
        // 使用错误处理器处理metadata获取错误
        if (error instanceof NetworkError || error instanceof TimeoutError || error instanceof MetadataError) {
          _this.errorHandler.handleError(error);
        } else {
          const metadataError = new MetadataError(
            `Metadata fetch failed for ${infoHashStr}: ${error.message || error}`,
            { 
              operation: 'metadata_fetch', 
              infoHash: infoHashStr, 
              peer: { host: peer.host, port: peer.port } 
            },
            error instanceof Error ? error : new Error(String(error))
          );
          _this.errorHandler.handleError(metadataError);
          error = metadataError;
        }
        
        _this.emit('metadataError', { infoHash, error });
      })
      .finally(() => {
        _this.dispatchMetadata();
        
        if (_this.metadataFetchingDict[infoHashStr] && _this.metadataFetchingDict[infoHashStr] > 1) {
          _this.metadataFetchingDict[infoHashStr] -= 1;
        } else {
          Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
        }
        
        const metadataFetchingCache = _this.cacheManager.getMetadataFetchingCache();
        metadataFetchingCache.delete(infoHashStr);
      });
    
    // 提高效率
    this.dispatchMetadata();
  }
  
  /**
   * 提升元数据获取效率
   */
  private boostMetadataFetching(): void {
    let counter;
    
    while (true) {
      if (this.metadataWaitingQueues.length === 0) break;
      
      const fetchingLength = Object.keys(this.metadataFetchingDict).length;
      if (fetchingLength >= this.config.maximumParallelFetchingTorrent) break;
      
      const waitingKeysNumber = this.getUniqueWaitingKeys().length;
      if (waitingKeysNumber > fetchingLength) {
        if (counter === undefined) counter = this.metadataWaitingQueues.length;
        this.dispatchMetadata();
        counter--;
        if (counter <= 0) break;
      } else {
        break;
      }
    }
  }
  
  /**
   * 移除重复的等待对象
   */
  private removeDuplicatedWaitingObjects(infoHashStr: string): void {
    this.metadataWaitingQueues = this.metadataWaitingQueues.filter(
      waitingObject => infoHashStr !== waitingObject.infoHashStr
    );
  }
  
  /**
   * 获取下一个获取键
   */
  private getNextFetchingKey(nextFetching: MetadataWaitingItem): string {
    const { infoHash, peer } = nextFetching;
    return `${peer.host}:${peer.port}-${infoHash.toString('hex')}`;
  }
  
  /**
   * 获取唯一的等待键
   */
  private getUniqueWaitingKeys(): string[] {
    const keysDict = this.metadataWaitingQueues.reduce((prev: Record<string, number>, curr) => {
      prev[curr.infoHashStr] = 1;
      return prev;
    }, {});
    
    return Object.keys(keysDict);
  }
  
  /**
   * 导出等待队列
   */
  exportWaitingQueue(): MetadataWaitingItem[] {
    return [...this.metadataWaitingQueues];
  }
  
  /**
   * 导入等待队列
   */
  importWaitingQueue(arr: any[]): void {
    if (!arr || Object.prototype.toString.call(arr) !== '[object Array]') {
      console.error('Not an array');
      return;
    }
    
    for (const tuple of arr) {
      if (!tuple.peer || !tuple.peer.host || !tuple.peer.port) {
        continue;
      }
      if (!tuple.infoHashStr) {
        continue;
      }
      
      tuple.infoHash = Buffer.from(tuple.infoHashStr, 'hex');
      this.metadataWaitingQueues.push(tuple);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const fetchings = Object.keys(this.metadataFetchingDict);
    const cacheStats = this.cacheManager.getStats();
    
    return {
      fetchingNum: fetchings.length,
      metadataWaitingQueueSize: this.metadataWaitingQueues.length,
      uniqueWaitingKeys: this.getUniqueWaitingKeys().length,
      ...cacheStats
    };
  }
  
  /**
   * 解析元数据
   */
  parseMetaData(rawMetadata: Buffer) {
    return metadataHelper.parseMetaData(rawMetadata);
  }
  
  /**
   * 清理数据
   */
  clear(): void {
    this.metadataWaitingQueues = [];
    this.metadataFetchingDict = {};
  }
}