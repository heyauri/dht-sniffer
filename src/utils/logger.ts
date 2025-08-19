/**
 * 日志管理工具文件
 * 
 * 本文件从统一的types/config.ts导入所有日志相关类型定义
 * 以避免重复定义并保持类型的一致性
 */

// 导入统一的类型定义
import {
  LogLevel,
  LoggerConfig,
  Logger
} from '../types/config';

/**
 * 导出默认实例
 */
export const logger = Logger.getInstance();

// 重新导出类型以保持向后兼容性
export {
  LogLevel,
  LoggerConfig,
  Logger
};