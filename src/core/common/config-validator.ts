/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
    public readonly expected?: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 验证规则接口
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  message?: string;
}

/**
 * 配置验证器 - 统一管理配置验证逻辑
 */
export class ConfigValidator {
  private rules: Map<string, ValidationRule[]>;
  private errors: ConfigValidationError[];

  constructor() {
    this.rules = new Map();
    this.errors = [];
  }

  /**
   * 添加验证规则
   */
  addRule(configType: string, rule: ValidationRule): void {
    if (!this.rules.has(configType)) {
      this.rules.set(configType, []);
    }
    this.rules.get(configType)!.push(rule);
  }

  /**
   * 批量添加验证规则
   */
  addRules(configType: string, rules: ValidationRule[]): void {
    if (!this.rules.has(configType)) {
      this.rules.set(configType, []);
    }
    this.rules.get(configType)!.push(...rules);
  }

  /**
   * 验证配置
   */
  validate(configType: string, config: any): boolean {
    this.errors = [];
    
    const rules = this.rules.get(configType);
    if (!rules) {
      // 如果没有找到规则，默认通过验证
      return true;
    }
    
    for (const rule of rules) {
      this.validateRule(config, rule);
    }
    
    return this.errors.length === 0;
  }

  /**
   * 验证单个规则
   */
  private validateRule(config: any, rule: ValidationRule): void {
    const value = config[rule.field];
    
    // 检查必填字段
    if (rule.required && (value === undefined || value === null)) {
      this.errors.push(new ConfigValidationError(
        rule.message || `Field '${rule.field}' is required`,
        rule.field,
        value,
        'required'
      ));
      return;
    }
    
    // 如果字段不是必填且为空，跳过其他验证
    if (!rule.required && (value === undefined || value === null)) {
      return;
    }
    
    // 类型验证
    if (rule.type && !this.validateType(value, rule.type)) {
      this.errors.push(new ConfigValidationError(
        rule.message || `Field '${rule.field}' must be of type ${rule.type}`,
        rule.field,
        value,
        rule.type
      ));
      return;
    }
    
    // 数值范围验证
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        this.errors.push(new ConfigValidationError(
          rule.message || `Field '${rule.field}' must be at least ${rule.min}`,
          rule.field,
          value,
          `>= ${rule.min}`
        ));
      }
      
      if (rule.max !== undefined && value > rule.max) {
        this.errors.push(new ConfigValidationError(
          rule.message || `Field '${rule.field}' must be at most ${rule.max}`,
          rule.field,
          value,
          `<= ${rule.max}`
        ));
      }
    }
    
    // 字符串长度验证
    if (rule.type === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        this.errors.push(new ConfigValidationError(
          rule.message || `Field '${rule.field}' must be at least ${rule.minLength} characters long`,
          rule.field,
          value,
          `length >= ${rule.minLength}`
        ));
      }
      
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        this.errors.push(new ConfigValidationError(
          rule.message || `Field '${rule.field}' must be at most ${rule.maxLength} characters long`,
          rule.field,
          value,
          `length <= ${rule.maxLength}`
        ));
      }
    }
    
    // 正则表达式验证
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      this.errors.push(new ConfigValidationError(
        rule.message || `Field '${rule.field}' does not match required pattern`,
        rule.field,
        value,
        rule.pattern.toString()
      ));
    }
    
    // 枚举值验证
    if (rule.enum && !rule.enum.includes(value)) {
      this.errors.push(new ConfigValidationError(
        rule.message || `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
        rule.field,
        value,
        `one of [${rule.enum.join(', ')}]`
      ));
    }
    
    // 自定义验证
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        const message = typeof customResult === 'string' ? customResult : 
          rule.message || `Field '${rule.field}' failed custom validation`;
        this.errors.push(new ConfigValidationError(
          message,
          rule.field,
          value,
          'custom validation'
        ));
      }
    }
  }

  /**
   * 类型验证
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 获取验证错误
   */
  getErrors(): ConfigValidationError[] {
    return [...this.errors];
  }

  /**
   * 获取第一个错误
   */
  getFirstError(): ConfigValidationError | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  /**
   * 清除错误
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * 移除验证规则
   */
  removeRules(configType: string): void {
    this.rules.delete(configType);
  }

  /**
   * 获取所有配置类型
   */
  getConfigTypes(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * 验证并抛出异常
   */
  validateOrThrow(configType: string, config: any): void {
    if (!this.validate(configType, config)) {
      const firstError = this.getFirstError();
      if (firstError) {
        throw firstError;
      }
    }
  }
}

/**
 * 预定义的验证规则集合
 */
export class ValidationRules {
  /**
   * DHT管理器配置规则
   */
  static getDHTManagerRules(): ValidationRule[] {
    return [
      {
        field: 'port',
        type: 'number',
        min: 1,
        max: 65535,
        required: true,
        message: 'Port must be between 1 and 65535'
      },
      {
        field: 'maxNodes',
        type: 'number',
        min: 1,
        required: true,
        message: 'maxNodes must be greater than 0'
      },
      {
        field: 'refreshInterval',
        type: 'number',
        min: 1000,
        message: 'refreshInterval must be at least 1000ms'
      }
    ];
  }

  /**
   * 元数据管理器配置规则
   */
  static getMetadataManagerRules(): ValidationRule[] {
    return [
      {
        field: 'maximumParallelFetchingTorrent',
        type: 'number',
        min: 1,
        required: true,
        message: 'maximumParallelFetchingTorrent must be greater than 0'
      },
      {
        field: 'maximumWaitingQueueSize',
        type: 'number',
        min: -1,
        message: 'maximumWaitingQueueSize must be -1 (unlimited) or greater'
      },
      {
        field: 'downloadMaxTime',
        type: 'number',
        min: 1000,
        message: 'downloadMaxTime must be at least 1000ms'
      },
      {
        field: 'aggressiveLevel',
        type: 'number',
        min: 0,
        max: 2,
        message: 'aggressiveLevel must be between 0 and 2'
      },
      {
        field: 'maxRetries',
        type: 'number',
        min: 0,
        message: 'maxRetries must be greater than or equal to 0'
      },
      {
        field: 'retryDelay',
        type: 'number',
        min: 0,
        message: 'retryDelay must be greater than or equal to 0'
      }
    ];
  }

  /**
   * 缓存管理器配置规则
   */
  static getCacheManagerRules(): ValidationRule[] {
    return [
      {
        field: 'maxCacheSize',
        type: 'number',
        min: 1,
        required: true,
        message: 'maxCacheSize must be greater than 0'
      },
      {
        field: 'cacheTTL',
        type: 'number',
        min: 0,
        message: 'cacheTTL must be greater than or equal to 0'
      },
      {
        field: 'enableCompression',
        type: 'boolean',
        message: 'enableCompression must be a boolean'
      }
    ];
  }

  /**
   * 基础管理器配置规则
   */
  static getBaseManagerRules(): ValidationRule[] {
    return [
      {
        field: 'enableErrorHandling',
        type: 'boolean',
        message: 'enableErrorHandling must be a boolean'
      },
      {
        field: 'enableMemoryMonitoring',
        type: 'boolean',
        message: 'enableMemoryMonitoring must be a boolean'
      },
      {
        field: 'cleanupInterval',
        type: 'number',
        min: 1,
        message: 'cleanupInterval must be a positive number'
      },
      {
        field: 'memoryThreshold',
        type: 'number',
        min: 1,
        message: 'memoryThreshold must be a positive number'
      }
    ];
  }
}

/**
 * 创建预配置的验证器实例
 */
export function createConfigValidator(): ConfigValidator {
  const validator = new ConfigValidator();
  
  // 添加预定义规则
  validator.addRules('DHTManager', ValidationRules.getDHTManagerRules());
  validator.addRules('MetadataManager', ValidationRules.getMetadataManagerRules());
  validator.addRules('CacheManager', ValidationRules.getCacheManagerRules());
  validator.addRules('BaseManager', ValidationRules.getBaseManagerRules());
  
  return validator;
}