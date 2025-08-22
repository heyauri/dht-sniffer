import { EventEmitter } from 'events';
import { ErrorHandlerImpl } from '../errors/error-handler-impl';
import { ErrorMonitor } from '../errors/error-monitor';
import { DHTManager } from './dht-manager';
import { PeerManager } from './peer-manager';
import { CacheManager } from './cache-manager';
import { MetadataManager } from './metadata-manager';

/**
 * 依赖注入容器 - 解决管理器间的循环依赖问题
 */
export class DIContainer extends EventEmitter {
  private services: Map<string, () => any> = new Map();
  private singletons: Map<string, any> = new Map();
  private instances: Map<string, any> = new Map();
  private initializing: Set<string> = new Set();

  /**
   * 注册服务
   * @param name 服务名称
   * @param factory 工厂函数
   * @param singleton 是否为单例
   */
  register<T>(name: string, factory: () => T, singleton = false): void {
    if (singleton) {
      this.singletons.set(name, factory);
    } else {
      this.services.set(name, factory);
    }
    this.emit('serviceRegistered', { name, singleton });
  }

  /**
   * 获取服务实例
   * @param name 服务名称
   * @returns 服务实例
   */
  get<T>(name: string): T {
    // 检查是否正在初始化（防止循环依赖）
    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected for service: ${name}`);
    }

    // 首先检查已存在的实例
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    // 检查单例
    if (this.singletons.has(name)) {
      const factory = this.singletons.get(name)!;
      this.initializing.add(name);
      
      try {
        const instance = factory();
        this.instances.set(name, instance);
        this.initializing.delete(name);
        return instance;
      } catch (error) {
        this.initializing.delete(name);
        throw error;
      }
    }

    // 检查普通服务
    if (this.services.has(name)) {
      const factory = this.services.get(name)!;
      this.initializing.add(name);
      
      try {
        const instance = factory();
        this.initializing.delete(name);
        return instance;
      } catch (error) {
        this.initializing.delete(name);
        throw error;
      }
    }

    throw new Error(`Service ${name} not found`);
  }

  /**
   * 检查服务是否存在
   * @param name 服务名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.services.has(name) || this.singletons.has(name) || this.instances.has(name);
  }

  /**
   * 移除服务
   * @param name 服务名称
   */
  remove(name: string): void {
    this.services.delete(name);
    this.singletons.delete(name);
    const instance = this.instances.get(name);
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
    }
    this.instances.delete(name);
    this.emit('serviceRemoved', { name });
  }

  /**
   * 清空所有服务
   */
  clear(): void {
    // 销毁所有实例
    this.instances.forEach((instance, name) => {
      if (typeof instance.destroy === 'function') {
        try {
          instance.destroy();
        } catch (error) {
          console.error(`Error destroying service ${name}:`, error);
        }
      }
    });
    
    this.services.clear();
    this.singletons.clear();
    this.instances.clear();
    this.initializing.clear();
    this.emit('containerCleared');
  }

  /**
   * 获取所有已注册的服务名称
   * @returns 服务名称列表
   */
  getServiceNames(): string[] {
    return [
      ...Array.from(this.services.keys()),
      ...Array.from(this.singletons.keys()),
      ...Array.from(this.instances.keys())
    ];
  }

  /**
   * 获取容器统计信息
   * @returns 统计信息
   */
  getStats() {
    return {
      services: this.services.size,
      singletons: this.singletons.size,
      instances: this.instances.size,
      total: this.services.size + this.singletons.size + this.instances.size,
      serviceNames: this.getServiceNames()
    };
  }
}

/**
 * 创建默认的依赖注入容器
 * @param config 应用配置
 * @returns 配置好的容器
 */
export function createDefaultContainer(config: any): DIContainer {
  const container = new DIContainer();
  
  // 注册错误处理器（单例）
  container.register('errorHandler', () => new ErrorHandlerImpl(), true);
  
  // 注册错误监控器（单例）
  container.register('errorMonitor', () => {
    const errorHandler = container.get<ErrorHandlerImpl>('errorHandler');
    const errorMonitorConfig = config.errorMonitorConfig || {};
    return new ErrorMonitor(errorHandler, errorMonitorConfig);
  }, true);
  
  // 注册缓存管理器（单例）
  container.register('cacheManager', () => {
    const errorHandler = container.get<ErrorHandlerImpl>('errorHandler');
    const cacheConfig = config.cache || {
      fetchedTupleSize: 1000,
      fetchedInfoHashSize: 5000,
      findNodeCacheSize: 2000,
      latestCalledPeersSize: 1000,
      usefulPeersSize: 5000,
      metadataFetchingCacheSize: 1000
    };
    return new CacheManager(cacheConfig, errorHandler);
  }, true);
  
  // 注册对等节点管理器（单例）
  container.register('peerManager', () => {
    const errorHandler = container.get<ErrorHandlerImpl>('errorHandler');
    const cacheManager = container.get<any>('cacheManager');
    const peerConfig = config.peer || {};
    return new PeerManager({
      ...peerConfig,
      enableErrorHandling: true,
      enableMemoryMonitoring: true
    } as any, null, cacheManager, errorHandler);
  }, true);
  
  // 注册元数据管理器（单例）
  container.register('metadataManager', () => {
    const errorHandler = container.get<ErrorHandlerImpl>('errorHandler');
    const cacheManager = container.get<any>('cacheManager');
    const metadataConfig = config.metadata || {};
    return new MetadataManager({
      ...metadataConfig,
      enableErrorHandling: true,
      enableMemoryMonitoring: true
    } as any, errorHandler, cacheManager);
  }, true);
  
  // 注册DHT管理器（单例）
  container.register('dhtManager', () => {
    const errorHandler = container.get<ErrorHandlerImpl>('errorHandler');
    const peerManager = container.get<any>('peerManager');
    const dhtConfig = config.dht || {};
    return new DHTManager({
      ...dhtConfig,
      enableErrorHandling: true,
      enableMemoryMonitoring: true
    } as any, errorHandler, peerManager);
  }, true);
  
  return container;
}

// 导出全局容器实例
export const globalContainer = new DIContainer();