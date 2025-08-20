/**
 * 错误类型定义文件
 * 
 * 本文件从统一的types/error.ts导入所有类型定义
 * 以避免重复定义并保持类型的一致性
 */

// 导入统一的类型定义
import {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  AppError,
  NetworkError,
  SystemError,
  DHTError,
  MetadataError,
  CacheError,
  ValidationError,
  ConfigError,
  TimeoutError,
  ErrorRecord,
  RecoveryOptions,
  RecoveryResult,
  ErrorHandler,
  ErrorStats,
  ErrorReport,
  isAppError
} from '../types/error';

// 重新导出类型以保持向后兼容性
export {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  AppError,
  NetworkError,
  SystemError,
  DHTError,
  MetadataError,
  CacheError,
  ValidationError,
  ConfigError,
  TimeoutError,
  ErrorRecord,
  RecoveryOptions,
  RecoveryResult,
  ErrorHandler,
  ErrorStats,
  ErrorReport,
  isAppError
};