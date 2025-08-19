/**
 * 工具相关类型定义
 */

import { AppError, ErrorType, ErrorSeverity } from './error';

/**
 * 类型守卫函数类型
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * 类型检查结果接口
 */
export interface TypeCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 类型验证器接口
 */
export interface TypeValidator<T = any> {
  validate(value: unknown): TypeCheckResult;
  assert(value: unknown): T;
  isType(value: unknown): value is T;
}

/**
 * 对象类型定义接口
 */
export interface ObjectTypeDefinition {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'buffer' | 'function';
    required?: boolean;
    validator?: (value: unknown) => boolean;
    defaultValue?: any;
    description?: string;
  };
}

/**
 * 数组类型定义接口
 */
export interface ArrayTypeDefinition {
  elementType: 'string' | 'number' | 'boolean' | 'object' | 'buffer';
  minLength?: number;
  maxLength?: number;
  unique?: boolean;
  validator?: (value: unknown) => boolean;
}

/**
 * 缓冲区类型定义接口
 */
export interface BufferTypeDefinition {
  length?: number;
  encoding?: 'hex' | 'base64' | 'utf8' | 'binary';
  validator?: (buffer: Buffer) => boolean;
}

/**
 * 函数类型定义接口
 */
export interface FunctionTypeDefinition {
  parameters?: ObjectTypeDefinition;
  returnType?: string;
  async?: boolean;
}

/**
 * 类型守卫集合
 */
export interface TypeGuards {
  isString: TypeGuard<string>;
  isNumber: TypeGuard<number>;
  isBoolean: TypeGuard<boolean>;
  isObject: TypeGuard<Record<string, unknown>>;
  isArray: TypeGuard<unknown[]>;
  isBuffer: TypeGuard<Buffer>;
  isFunction: TypeGuard<Function>;
  isUndefined: TypeGuard<undefined>;
  isNull: TypeGuard<null>;
  isDate: TypeGuard<Date>;
  isRegExp: TypeGuard<RegExp>;
  isPromise: TypeGuard<Promise<unknown>>;
  isAppError: TypeGuard<AppError>;
  isPeer: TypeGuard<import('./dht').Peer>;
  isNode: TypeGuard<import('./dht').Node>;
  isMetadata: TypeGuard<import('./metadata').Metadata>;
  isDHTMessage: TypeGuard<import('./dht').DHTMessage>;
}

/**
 * 类型转换器接口
 */
export interface TypeConverter {
  toString(value: unknown): string;
  toNumber(value: unknown): number;
  toBoolean(value: unknown): boolean;
  toBuffer(value: unknown, encoding?: BufferEncoding): Buffer;
  toDate(value: unknown): Date;
  toJSON(value: unknown): string;
  fromJSON<T = any>(json: string): T;
}

/**
 * 类型工具接口
 */
export interface TypeUtils {
  getTypeName(value: unknown): string;
  isPrimitive(value: unknown): boolean;
  isObjectLike(value: unknown): boolean;
  isEmpty(value: unknown): boolean;
  isEqual(a: unknown, b: unknown): boolean;
  clone<T>(value: T): T;
  merge<T extends object>(target: T, source: Partial<T>): T;
  pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
  omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
}

/**
 * 类型验证选项接口
 */
export interface TypeValidationOptions {
  strict?: boolean;
  allowUnknown?: boolean;
  convertTypes?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * 类型验证错误接口
 */
export interface ValidationError {
  path: string;
  message: string;
  value: unknown;
  expected?: string;
  received?: string;
}

/**
 * 类型验证上下文接口
 */
export interface ValidationContext {
  path: string;
  value: unknown;
  parent?: unknown;
  key?: string | number;
  options: TypeValidationOptions;
  errors: ValidationError[];
}

/**
 * 类型验证规则接口
 */
export interface ValidationRule {
  name: string;
  validate: (context: ValidationContext) => boolean;
  message?: string;
}

/**
 * 类型验证器工厂接口
 */
export interface ValidatorFactory {
  object(definition: ObjectTypeDefinition): TypeValidator<Record<string, unknown>>;
  array(definition: ArrayTypeDefinition): TypeValidator<unknown[]>;
  buffer(definition: BufferTypeDefinition): TypeValidator<Buffer>;
  string(options?: { min?: number; max?: number; pattern?: RegExp }): TypeValidator<string>;
  number(options?: { min?: number; max?: number; integer?: boolean }): TypeValidator<number>;
  boolean(): TypeValidator<boolean>;
  date(): TypeValidator<Date>;
  union<T>(types: TypeValidator<T>[]): TypeValidator<T>;
  optional<T>(validator: TypeValidator<T>): TypeValidator<T | undefined>;
  nullable<T>(validator: TypeValidator<T>): TypeValidator<T | null>;
  record<K extends string, V>(keyValidator: TypeValidator<K>, valueValidator: TypeValidator<V>): TypeValidator<Record<K, V>>;
}

/**
 * 类型守卫工具接口
 */
export interface TypeGuardUtils {
  createTypeGuard<T>(validator: (value: unknown) => boolean): TypeGuard<T>;
  composeGuards<T>(...guards: TypeGuard<T>[]): TypeGuard<T>;
  negateGuard<T>(guard: TypeGuard<T>): TypeGuard<unknown>;
  orGuards<T, U>(guard1: TypeGuard<T>, guard2: TypeGuard<U>): TypeGuard<T | U>;
  andGuards<T>(guard1: TypeGuard<T>, guard2: TypeGuard<T>): TypeGuard<T>;
}

/**
 * 类型序列化接口
 */
export interface TypeSerializer {
  serialize<T>(value: T): string;
  deserialize<T>(data: string): T;
  supports(type: string): boolean;
}

/**
 * 类型注册表接口
 */
export interface TypeRegistry {
  register<T>(name: string, type: TypeValidator<T>): void;
  get<T>(name: string): TypeValidator<T> | undefined;
  has(name: string): boolean;
  unregister(name: string): boolean;
  list(): string[];
}