import { ValidationError } from '../types/error';

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 基础验证器抽象类
 */
export abstract class BaseValidator<T> {
  /**
   * 验证配置
   * @param config 要验证的配置
   * @returns 验证结果
   */
  abstract validate(config: T): ValidationResult;

  /**
   * 验证数字范围
   * @param value 数值
   * @param min 最小值
   * @param max 最大值
   * @param field 字段名
   * @param required 是否必需
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateNumber(
    value: number | undefined,
    min: number,
    max: number,
    field: string,
    required = true
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${field} must be a number`, { field, value });
    }

    if (value < min || value > max) {
      throw new ValidationError(`${field} must be between ${min} and ${max}`, { field, value });
    }
  }

  /**
   * 验证字符串
   * @param value 字符串值
   * @param field 字段名
   * @param required 是否必需
   * @param minLength 最小长度
   * @param maxLength 最大长度
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateString(
    value: string | undefined,
    field: string,
    required = true,
    minLength = 0,
    maxLength = Infinity
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    if (typeof value !== 'string') {
      throw new ValidationError(`${field} must be a string`, { field, value });
    }

    if (required && value.trim() === '') {
      throw new ValidationError(`${field} cannot be empty`, { field, value });
    }

    if (value.length < minLength || value.length > maxLength) {
      throw new ValidationError(`${field} length must be between ${minLength} and ${maxLength}`, { 
        field, 
        value,
        length: value.length
      });
    }
  }

  /**
   * 验证布尔值
   * @param value 布尔值
   * @param field 字段名
   * @param required 是否必需
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateBoolean(
    value: boolean | undefined,
    field: string,
    required = true
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    if (typeof value !== 'boolean') {
      throw new ValidationError(`${field} must be a boolean`, { field, value });
    }
  }

  /**
   * 验证数组
   * @param value 数组值
   * @param field 字段名
   * @param required 是否必需
   * @param minLength 最小长度
   * @param maxLength 最大长度
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateArray(
    value: any[] | undefined,
    field: string,
    required = true,
    minLength = 0,
    maxLength = Infinity
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    if (!Array.isArray(value)) {
      throw new ValidationError(`${field} must be an array`, { field, value });
    }

    if (value.length < minLength || value.length > maxLength) {
      throw new ValidationError(`${field} length must be between ${minLength} and ${maxLength}`, {
        field,
        value,
        length: value.length
      });
    }
  }

  /**
   * 验证对象
   * @param value 对象值
   * @param field 字段名
   * @param required 是否必需
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateObject(
    value: object | undefined,
    field: string,
    required = true
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(`${field} must be an object`, { field, value });
    }
  }

  /**
   * 验证IP地址格式
   * @param value IP地址字符串
   * @param field 字段名
   * @param required 是否必需
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateIPAddress(
    value: string | undefined,
    field: string,
    required = true
  ): void {
    if (value === undefined) {
      if (required) {
        throw new ValidationError(`${field} is required`, { field, value });
      }
      return;
    }

    this.validateString(value, field, required);

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(value)) {
      throw new ValidationError(`${field} must be a valid IP address`, { field, value });
    }
  }

  /**
   * 验证端口号
   * @param value 端口号
   * @param field 字段名
   * @param required 是否必需
   * @throws ValidationError 当验证失败时抛出
   */
  protected validatePort(
    value: number | undefined,
    field: string,
    required = true
  ): void {
    this.validateNumber(value, 1, 65535, field, required);
  }

  /**
   * 验证时间间隔（毫秒）
   * @param value 时间间隔
   * @param field 字段名
   * @param required 是否必需
   * @param min 最小值
   * @throws ValidationError 当验证失败时抛出
   */
  protected validateInterval(
    value: number | undefined,
    field: string,
    required = true,
    min = 0
  ): void {
    this.validateNumber(value, min, Infinity, field, required);
  }
}

/**
 * DHT配置验证器
 */
export class DHTConfigValidator extends BaseValidator<any> {
  validate(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 验证address
      if (config.address !== undefined) {
        try {
          this.validateIPAddress(config.address, 'address', false);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(error.message);
          }
        }
      }

      // 验证port
      try {
        this.validatePort(config.port, 'port', false);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }

      // 验证nodesMaxSize
      try {
        this.validateNumber(config.nodesMaxSize, 1, Infinity, 'nodesMaxSize');
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }

      // 验证refreshPeriod
      try {
        this.validateInterval(config.refreshPeriod, 'refreshPeriod', false, 1000);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }

      // 验证announcePeriod
      try {
        this.validateInterval(config.announcePeriod, 'announcePeriod', false, 1000);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }

      // 验证bootstrap
      if (config.bootstrap !== undefined) {
        try {
          if (typeof config.bootstrap !== 'boolean' && !Array.isArray(config.bootstrap)) {
            throw new ValidationError('bootstrap must be a boolean or string array', { 
              field: 'bootstrap', 
              value: config.bootstrap 
            });
          }
          
          if (Array.isArray(config.bootstrap)) {
            for (let i = 0; i < config.bootstrap.length; i++) {
              const node = config.bootstrap[i];
              if (typeof node !== 'string') {
                errors.push(`bootstrap[${i}] must be a string`);
              }
            }
          }
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(error.message);
          }
        }
      }

      // 验证内存相关配置
      if (config.memoryThreshold !== undefined) {
        try {
          this.validateNumber(config.memoryThreshold, 1, Infinity, 'memoryThreshold');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证清理间隔
      if (config.cleanupInterval !== undefined) {
        try {
          this.validateInterval(config.cleanupInterval, 'cleanupInterval', false);
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * 缓存配置验证器
 */
export class CacheConfigValidator extends BaseValidator<any> {
  validate(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 验证缓存大小配置
      const sizeFields = [
        'fetchedTupleSize',
        'fetchedInfoHashSize', 
        'findNodeCacheSize',
        'latestCalledPeersSize',
        'usefulPeersSize',
        'metadataFetchingCacheSize'
      ];

      sizeFields.forEach(field => {
        if (config[field] !== undefined) {
          try {
            this.validateNumber(config[field], 1, 1000000, field);
          } catch (error) {
            if (error instanceof ValidationError) {
              errors.push(error.message);
            }
          }
        }
      });

      // 验证压缩阈值
      if (config.compressionThreshold !== undefined) {
        try {
          this.validateNumber(config.compressionThreshold, 1, Infinity, 'compressionThreshold');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证重试配置
      if (config.maxRetryAttempts !== undefined) {
        try {
          this.validateNumber(config.maxRetryAttempts, 0, 100, 'maxRetryAttempts');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证熔断器配置
      if (config.circuitBreakerThreshold !== undefined) {
        try {
          this.validateNumber(config.circuitBreakerThreshold, 1, 100, 'circuitBreakerThreshold');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * 元数据配置验证器
 */
export class MetadataConfigValidator extends BaseValidator<any> {
  validate(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 验证并行获取数量
      try {
        this.validateNumber(config.maximumParallelFetchingTorrent, 1, 1000, 'maximumParallelFetchingTorrent');
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }

      // 验证等待队列大小
      if (config.maximumWaitingQueueSize !== undefined) {
        try {
          this.validateNumber(config.maximumWaitingQueueSize, 0, 10000, 'maximumWaitingQueueSize');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证超时配置
      if (config.requestTimeout !== undefined) {
        try {
          this.validateInterval(config.requestTimeout, 'requestTimeout', false, 1000);
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证重试配置
      if (config.maxRetries !== undefined) {
        try {
          this.validateNumber(config.maxRetries, 0, 10, 'maxRetries');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证重试延迟
      if (config.retryDelay !== undefined) {
        try {
          this.validateInterval(config.retryDelay, 'retryDelay', false);
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * 对等节点配置验证器
 */
export class PeerConfigValidator extends BaseValidator<any> {
  validate(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 验证最大节点数
      if (config.maxNodes !== undefined) {
        try {
          this.validateNumber(config.maxNodes, 1, 100000, 'maxNodes');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证连接超时
      if (config.connectionTimeout !== undefined) {
        try {
          this.validateInterval(config.connectionTimeout, 'connectionTimeout', false, 1000);
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证心跳间隔
      if (config.heartbeatInterval !== undefined) {
        try {
          this.validateInterval(config.heartbeatInterval, 'heartbeatInterval', false, 1000);
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * 错误处理配置验证器
 */
export class ErrorConfigValidator extends BaseValidator<any> {
  validate(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 验证错误处理开关
      if (config.enableErrorHandling !== undefined) {
        try {
          this.validateBoolean(config.enableErrorHandling, 'enableErrorHandling');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证最大错误历史记录
      if (config.maxErrorHistory !== undefined) {
        try {
          this.validateNumber(config.maxErrorHistory, 0, 10000, 'maxErrorHistory');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

      // 验证错误报告级别
      if (config.errorReportingLevel !== undefined) {
        try {
          this.validateNumber(config.errorReportingLevel, 0, 3, 'errorReportingLevel');
        } catch (error) {
          if (error instanceof ValidationError) {
            warnings.push(error.message);
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * 配置验证管理器
 */
export class ConfigValidatorManager {
  private validators: Map<string, BaseValidator<any>> = new Map();

  constructor() {
    // 注册默认验证器
    this.registerValidator('dht', new DHTConfigValidator());
    this.registerValidator('cache', new CacheConfigValidator());
    this.registerValidator('metadata', new MetadataConfigValidator());
    this.registerValidator('peer', new PeerConfigValidator());
    this.registerValidator('error', new ErrorConfigValidator());
  }

  /**
   * 注册验证器
   * @param name 验证器名称
   * @param validator 验证器实例
   */
  registerValidator(name: string, validator: BaseValidator<any>): void {
    this.validators.set(name, validator);
  }

  /**
   * 验证配置
   * @param type 配置类型
   * @param config 配置对象
   * @returns 验证结果
   */
  validate(type: string, config: any): ValidationResult {
    const validator = this.validators.get(type);
    if (!validator) {
      return {
        isValid: false,
        errors: [`No validator found for type: ${type}`]
      };
    }

    return validator.validate(config);
  }

  /**
   * 批量验证配置
   * @param configs 配置对象映射
   * @returns 验证结果映射
   */
  validateAll(configs: Record<string, any>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const [type, config] of Object.entries(configs)) {
      results[type] = this.validate(type, config);
    }

    return results;
  }
}

// 导出全局验证器管理器实例
export const globalConfigValidator = new ConfigValidatorManager();