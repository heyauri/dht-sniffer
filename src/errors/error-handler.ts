// 导入统一的类型定义
import {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  AppError,
  NetworkError,
  DHTError,
  MetadataError,
  CacheError,
  ValidationError,
  SystemError,
  ErrorHandler,
  ErrorStats,
  ErrorReport
} from '../types/error';
import { ErrorHandlerImpl } from './error-handler-impl';

// 重新导出类型以保持向后兼容性
export {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  AppError,
  NetworkError,
  DHTError,
  MetadataError,
  CacheError,
  ValidationError,
  SystemError,
  ErrorHandler,
  ErrorStats,
  ErrorReport
};

// 导出ErrorHandler实现类
export { ErrorHandlerImpl };

// 为了向后兼容，导出ErrorHandlerImpl作为默认的ErrorHandler实现
export { ErrorHandlerImpl as DefaultErrorHandler };

// 创建一个全局错误处理器实例
export const globalErrorHandler = new ErrorHandlerImpl();