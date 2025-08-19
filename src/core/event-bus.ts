import { EventEmitter } from 'events';

/**
 * 事件数据接口
 */
export interface EventData {
  [key: string]: any;
}

/**
 * 事件处理器函数类型
 */
export type EventHandler = (data: EventData) => void | Promise<void>;

/**
 * 事件订阅信息
 */
export interface EventSubscription {
  event: string;
  handler: EventHandler;
  once?: boolean;
  priority?: number;
}

/**
 * 事件总线 - 解耦管理器间的事件通信
 */
export class EventBus extends EventEmitter {
  private subscribers: Map<string, EventHandler[]> = new Map();
  private prioritySubscribers: Map<string, Map<number, EventHandler[]>> = new Map();
  private eventHistory: EventData[] = [];
  private maxHistorySize = 1000;
  private eventStats: Map<string, { count: number; lastEmitted: number }> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100); // 增加最大监听器数量
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @param options 订阅选项
   * @returns 取消订阅函数
   */
  subscribe(
    event: string,
    handler: EventHandler,
    options: {
      once?: boolean;
      priority?: number;
    } = {}
  ): () => void {
    const { once = false, priority = 0 } = options;

    // 如果有优先级，使用优先级订阅
    if (priority !== 0) {
      if (!this.prioritySubscribers.has(event)) {
        this.prioritySubscribers.set(event, new Map());
      }
      
      const priorityMap = this.prioritySubscribers.get(event)!;
      if (!priorityMap.has(priority)) {
        priorityMap.set(priority, []);
      }
      
      priorityMap.get(priority)!.push(handler);
      
      // 按优先级排序
      const sortedPriorities = Array.from(priorityMap.keys()).sort((a, b) => b - a);
      const allHandlers: EventHandler[] = [];
      sortedPriorities.forEach(p => {
        allHandlers.push(...priorityMap.get(p)!);
      });
      
      // 更新普通订阅列表以保持兼容性
      this.subscribers.set(event, allHandlers);
    } else {
      // 普通订阅
      if (!this.subscribers.has(event)) {
        this.subscribers.set(event, []);
      }
      this.subscribers.get(event)!.push(handler);
    }

    // 如果是单次订阅，在触发后自动取消
    if (once) {
      const onceHandler = (data: EventData) => {
        handler(data);
        this.unsubscribe(event, handler);
      };
      
      // 替换处理器
      const index = this.subscribers.get(event)!.indexOf(handler);
      if (index > -1) {
        this.subscribers.get(event)![index] = onceHandler;
      }
    }

    // 返回取消订阅函数
    return () => this.unsubscribe(event, handler);
  }

  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 事件处理器
   */
  unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      // 如果没有订阅者了，删除事件
      if (handlers.length === 0) {
        this.subscribers.delete(event);
      }
    }

    // 同时从优先级订阅中删除
    const priorityMap = this.prioritySubscribers.get(event);
    if (priorityMap) {
      priorityMap.forEach((handlers, priority) => {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        
        // 如果该优先级没有处理器了，删除
        if (handlers.length === 0) {
          priorityMap.delete(priority);
        }
      });
      
      // 如果没有优先级订阅者了，删除
      if (priorityMap.size === 0) {
        this.prioritySubscribers.delete(event);
      }
    }
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   * @param options 发布选项
   */
  publish(
    event: string,
    data: EventData = {},
    options: {
      async?: boolean;
      recordHistory?: boolean;
    } = {}
  ): void {
    const { async = false, recordHistory = true } = options;

    // 添加时间戳和事件名称
    const eventData: EventData = {
      ...data,
      timestamp: Date.now(),
      eventName: event
    };

    // 记录事件历史
    if (recordHistory) {
      this.recordEvent(event, eventData);
    }

    // 更新事件统计
    this.updateEventStats(event);

    // 获取所有订阅者
    const handlers = this.subscribers.get(event) || [];
    
    if (async) {
      // 异步执行处理器
      handlers.forEach(handler => {
        setImmediate(() => {
          try {
            handler(eventData);
          } catch (error) {
            console.error(`Error in async event handler for ${event}:`, error);
            this.publish('error', { 
              originalEvent: event, 
              error: error instanceof Error ? error.message : String(error),
              handler: handler.name || 'anonymous'
            });
          }
        });
      });
    } else {
      // 同步执行处理器
      handlers.forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
          this.publish('error', { 
            originalEvent: event, 
            error: error instanceof Error ? error.message : String(error),
            handler: handler.name || 'anonymous'
          });
        }
      });
    }

    // 同时触发 EventEmitter 的事件（保持兼容性）
    super.emit(event, eventData);
  }

  /**
   * 异步发布事件并等待所有处理器完成
   * @param event 事件名称
   * @param data 事件数据
   * @returns Promise<void>
   */
  async publishAsync(event: string, data: EventData = {}): Promise<void> {
    const eventData: EventData = {
      ...data,
      timestamp: Date.now(),
      eventName: event
    };

    this.recordEvent(event, eventData);
    this.updateEventStats(event);

    const handlers = this.subscribers.get(event) || [];
    const promises = handlers.map(handler => {
      try {
        const result = handler(eventData);
        return result instanceof Promise ? result : Promise.resolve();
      } catch (error) {
        console.error(`Error in async event handler for ${event}:`, error);
        this.publish('error', { 
          originalEvent: event, 
          error: error instanceof Error ? error.message : String(error),
          handler: handler.name || 'anonymous'
        });
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
    super.emit(event, eventData);
  }

  /**
   * 记录事件历史
   * @param event 事件名称
   * @param data 事件数据
   */
  private recordEvent(event: string, data: EventData): void {
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    });

    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 更新事件统计
   * @param event 事件名称
   */
  private updateEventStats(event: string): void {
    const stats = this.eventStats.get(event) || { count: 0, lastEmitted: 0 };
    stats.count++;
    stats.lastEmitted = Date.now();
    this.eventStats.set(event, stats);
  }

  /**
   * 获取事件历史
   * @param event 事件名称（可选）
 * @param limit 限制数量
   * @returns 事件历史记录
   */
  getEventHistory(event?: string, limit = 100): EventData[] {
    let history = this.eventHistory;
    
    if (event) {
      history = history.filter(item => item.event === event);
    }
    
    return history.slice(-limit);
  }

  /**
   * 获取事件统计
   * @returns 事件统计信息
   */
  getEventStats(): Record<string, { count: number; lastEmitted: number }> {
    const stats: Record<string, { count: number; lastEmitted: number }> = {};
    this.eventStats.forEach((value, key) => {
      stats[key] = { ...value };
    });
    return stats;
  }

  /**
   * 获取订阅者数量
   * @param event 事件名称（可选）
   * @returns 订阅者数量
   */
  getSubscriberCount(event?: string): number {
    if (event) {
      return this.subscribers.get(event)?.length || 0;
    }
    
    let total = 0;
    this.subscribers.forEach(handlers => {
      total += handlers.length;
    });
    return total;
  }

  /**
   * 获取所有事件名称
   * @returns 事件名称列表
   */
  getEventNames(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * 清空事件历史
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 清空所有订阅
   */
  clearAllSubscriptions(): void {
    this.subscribers.clear();
    this.prioritySubscribers.clear();
    this.removeAllListeners();
  }

  /**
   * 设置最大历史记录大小
   * @param size 最大大小
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(0, size);
    
    // 如果当前历史记录超过新的大小，进行截断
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 检查是否有特定事件的订阅者
   * @param event 事件名称
   * @returns 是否有订阅者
   */
  hasSubscribers(event: string): boolean {
    return this.subscribers.has(event) && this.subscribers.get(event)!.length > 0;
  }
}

/**
 * 事件类型接口
 */
export interface IEventTypes {
  SYSTEM: {
    STARTUP: string;
    SHUTDOWN: string;
    error: string;
    warning: string;
    INFO: string;
    started: string;
    memoryWarning: string;
    performanceStats: string;
    healthCheck: string;
    memoryCleanupCompleted: string;
    restarting: string;
    restarted: string;
    restartFailed: string;
    shuttingDown: string;
    shutdownCompleted: string;
    shutdownFailed: string;
  };
  DHT: {
    STARTED: string;
    STOPPED: string;
    nodeDiscovered: string;
    nodeLost: string;
    querySent: string;
    queryReceived: string;
    responseReceived: string;
    peerFound: string;
    nodeFound: string;
    error: string;
    warning: string;
    infoHashFound: string;
  };
  PEER: {
    connected: string;
    disconnected: string;
    imported: string;
    exported: string;
    updated: string;
  };
  CACHE: {
    HIT: string;
    MISS: string;
    evicted: string;
    cleared: string;
    sizeChanged: string;
  };
  METADATA: {
    fetched: string;
    fetchFailed: string;
    queued: string;
    processing: string;
    completed: string;
    queueRequest: string;
    error: string;
  };
  MANAGER: {
    created: string;
    destroyed: string;
    cleanupCompleted: string;
    memoryWarning: string;
  };
}

/**
 * 事件类型常量
 */
export const EventTypes: IEventTypes = {
  // 系统事件
  SYSTEM: {
    STARTUP: 'system.startup',
    SHUTDOWN: 'system.shutdown',
    error: 'system.error',
      warning: 'system.warning',
    INFO: 'system.info',
    started: 'system.started',
    memoryWarning: 'system.memoryWarning',
    performanceStats: 'system.performanceStats',
    healthCheck: 'system.healthCheck',
    memoryCleanupCompleted: 'system.memoryCleanupCompleted',
    restarting: 'system.restarting',
    restarted: 'system.restarted',
    restartFailed: 'system.restartFailed',
    shuttingDown: 'system.shuttingDown',
    shutdownCompleted: 'system.shutdownCompleted',
    shutdownFailed: 'system.shutdownFailed'
  },
  
  // DHT事件
  DHT: {
    STARTED: 'dht.started',
    STOPPED: 'dht.stopped',
    nodeDiscovered: 'dht.nodeDiscovered',
    nodeLost: 'dht.nodeLost',
    querySent: 'dht.querySent',
    queryReceived: 'dht.queryReceived',
    responseReceived: 'dht.responseReceived',
    peerFound: 'dht.peerFound',
    nodeFound: 'dht.nodeFound',
    error: 'dht.error',
      warning: 'dht.warning',
    infoHashFound: 'dht.infoHashFound'
  },
  
  // 对等节点事件
  PEER: {
    connected: 'peer.connected',
    disconnected: 'peer.disconnected',
    imported: 'peer.imported',
    exported: 'peer.exported',
    updated: 'peer.updated'
  },
  
  // 缓存事件
  CACHE: {
    HIT: 'cache.hit',
    MISS: 'cache.miss',
    evicted: 'cache.evicted',
    cleared: 'cache.cleared',
    sizeChanged: 'cache.sizeChanged'
  },
  
  // 元数据事件
  METADATA: {
    fetched: 'metadata.fetched',
    fetchFailed: 'metadata.fetchFailed',
    queued: 'metadata.queued',
    processing: 'metadata.processing',
    completed: 'metadata.completed',
    queueRequest: 'metadata.queueRequest',
    error: 'metadata.error'
  },
  
  // 管理器事件
  MANAGER: {
    created: 'manager.created',
    destroyed: 'manager.destroyed',
    cleanupCompleted: 'manager.cleanupCompleted',
    memoryWarning: 'manager.memoryWarning'
  }
};

/**
 * 创建默认事件总线
 * @returns 配置好的事件总线
 */
export function createDefaultEventBus(): EventBus {
  const eventBus = new EventBus();
  
  // 设置默认的最大历史记录大小
  eventBus.setMaxHistorySize(500);
  
  // 监听系统错误事件
  eventBus.subscribe(EventTypes.SYSTEM.error, (data) => {
    console.error('[System Error]', data);
  }, { priority: 100 });
  
  // 监听系统警告事件
  eventBus.subscribe(EventTypes.SYSTEM.warning, (data) => {
    console.warn('[System Warning]', data);
  }, { priority: 90 });
  
  return eventBus;
}

// 导出全局事件总线实例
export const globalEventBus = createDefaultEventBus();