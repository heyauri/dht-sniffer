import { ErrorHandlerImpl } from '../../errors/error-handler';
import { ErrorType } from '../../types/error';

/**
 * 事件监听器配置接口
 */
export interface EventListenerConfig {
  event: string;
  handler: (...args: any[]) => void;
  errorHandler?: ErrorHandlerImpl;
  errorContext?: any;
  once?: boolean;
  priority?: number;
}

/**
 * 事件监听器混入接口
 */
export interface EventListenerMixin {
  setupEventListeners(): void;
  addEventListener(config: EventListenerConfig): void;
  removeEventListener(event: string, handler: (...args: any[]) => void): void;
  removeAllEventListeners(): void;
  safeEmit(event: string, ...args: any[]): boolean;
}

/**
 * 事件监听器混入实现
 */
export function withEventListeners<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base implements EventListenerMixin {
    private eventListeners: Map<string, Array<{ handler: (...args: any[]) => void; errorHandler?: ErrorHandlerImpl; errorContext?: any; priority?: number }>> = new Map();

    /**
     * 设置事件监听器（子类实现具体逻辑）
     */
    setupEventListeners(): void {
      // 子类实现具体的事件监听器设置
    }

    /**
     * 添加事件监听器
     */
    addEventListener(config: EventListenerConfig): void {
      const { event, handler, errorHandler, errorContext, once = false, priority = 0 } = config;
      
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      
      const listenerInfo = { handler, errorHandler, errorContext };
      const listeners = this.eventListeners.get(event)!;
      
      if (priority !== 0) {
        // 按优先级插入
        let inserted = false;
        for (let i = 0; i < listeners.length; i++) {
          if ((listeners[i] as any).priority < priority) {
            listeners.splice(i, 0, { ...listenerInfo, priority });
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          listeners.push({ ...listenerInfo, priority });
        }
      } else {
        listeners.push(listenerInfo);
      }
      
      // 添加到EventEmitter
      if (once) {
        this.once(event, this.createSafeHandler(handler, errorHandler, errorContext));
      } else {
        this.on(event, this.createSafeHandler(handler, errorHandler, errorContext));
      }
    }

    /**
     * 移除事件监听器
     */
    removeEventListener(event: string, handler: (...args: any[]) => void): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.findIndex(l => l.handler === handler);
        if (index !== -1) {
          listeners.splice(index, 1);
          this.off(event, handler);
        }
      }
    }

    /**
     * 移除所有事件监听器
     */
    removeAllEventListeners(): void {
      for (const [event, listeners] of this.eventListeners) {
        for (const { handler } of listeners) {
          this.off(event, handler);
        }
      }
      this.eventListeners.clear();
    }

    /**
     * 安全地发射事件
     */
    safeEmit(event: string, ...args: any[]): boolean {
      try {
        return this.emit(event, ...args);
      } catch (error) {
        console.error(`Error emitting event '${event}':`, error);
        return false;
      }
    }

    /**
     * 创建安全的处理器
     */
    private createSafeHandler(
      handler: (...args: any[]) => void,
      errorHandler?: ErrorHandlerImpl,
      errorContext?: any
    ): (...args: any[]) => void {
      return (...args: any[]) => {
        try {
          handler(...args);
        } catch (error) {
          if (errorHandler) {
            errorHandler.handleError(error as Error, {
              event,
              handler: handler.name || 'anonymous',
              ...errorContext,
              errorType: ErrorType.SYSTEM
            });
          } else {
            console.error(`Error in event handler for '${event}':`, error);
          }
        }
      };
    }

    /**
     * 批量设置事件监听器
     */
    setupBatchEventListeners(configs: EventListenerConfig[]): void {
      configs.forEach(config => this.addEventListener(config));
    }

    /**
     * 获取事件监听器数量
     */
    getEventListenerCount(event?: string): number {
      if (event) {
        return this.eventListeners.get(event)?.length || 0;
      }
      return Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.length, 0);
    }
  };
}

/**
 * 常用事件监听器配置工厂函数
 */
export class EventListenerFactory {
  /**
   * 创建错误事件监听器配置
   */
  static createErrorListener(
    _errorHandler: ErrorHandlerImpl,
    managerName: string,
    errorContext?: any
  ): EventListenerConfig {
    return {
      event: 'error',
      handler: (error: Error) => {
        _errorHandler.handleError(error, {
          manager: managerName,
          operation: 'event_listener',
          ...errorContext
        });
      }
    };
  }

  /**
   * 创建警告事件监听器配置
   */
  static createWarningListener(
    _errorHandler: ErrorHandlerImpl,
    managerName: string
  ): EventListenerConfig {
    return {
      event: 'warning',
      handler: (warning: string) => {
        _errorHandler.handleError(new Error(warning), {
          manager: managerName,
          operation: 'event_listener',
          severity: 'warning'
        });
      }
    };
  }

  /**
   * 创建性能警告监听器配置
   */
  static createPerformanceWarningListener(
    _errorHandler: ErrorHandlerImpl,
    managerName: string
  ): EventListenerConfig {
    return {
      event: 'performanceWarning',
      handler: (warning: any) => {
        console.warn(`[${managerName}] Performance warning: ${warning.type} - ${warning.metric} = ${warning.value}`);
      }
    };
  }

  /**
   * 创建内存清理监听器配置
   */
  static createMemoryCleanupListener(
    _errorHandler: ErrorHandlerImpl,
    managerName: string
  ): EventListenerConfig {
    return {
      event: 'memoryCleanup',
      handler: (cleanup: any) => {
        console.log(`[${managerName}] Memory cleanup: ${cleanup.cleanupType} - freed ${cleanup.memoryFreed} bytes`);
      }
    };
  }

  /**
   * 创建重试监听器配置
     */
  static createRetryListener(
    _errorHandler: ErrorHandlerImpl,
    managerName: string
  ): EventListenerConfig {
    return {
      event: 'retry',
      handler: (event: any) => {
        console.log(`[${managerName}] Retry event: ${event.operation} - attempt ${event.attempt}/${event.maxAttempts}`);
      }
    };
  }
}