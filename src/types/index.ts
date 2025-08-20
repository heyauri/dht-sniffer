/**
 * 类型定义统一导出文件
 * 
 * 本文件统一导出项目中所有的类型定义
 * 按功能模块组织，便于维护和使用
 */

// 基础通用类型
export * from './common';

// DHT相关类型
export * from './dht';

// 元数据相关类型
export * from './metadata';

// 缓存相关类型
export * from './cache';

// 错误处理相关类型
import {
  ErrorType,
  ErrorSeverity,
  AppError,
  NetworkError,
  DHTError,
  MetadataError as MetadataErrorFromError,
  CacheError,
  ConfigError,
  ValidationError,
  SystemError,
  ErrorHandler as ErrorHandlerInterface,
  ErrorStats,
  ErrorReport,
  isAppError
} from './error';

export {

  ErrorHandlerInterface as ErrorHandler,
  ErrorStats,
  ErrorReport,
  isAppError
};

// 配置和日志相关类型
export * from './config';

// 协议扩展相关类型
export * from './protocol';

// 工具相关类型
export * from './utils';

// 为了保持向后兼容性，重新导出一些常用的核心类型
// 这些类型在项目的多个地方被使用
import {
  Peer,
  Node,
  BaseDHTConfig,
  DHTOptions,
  DHTMessage,
  DHTReply,
  StartEvent
} from './dht';

import {
  Metadata,
  MetadataError as MetadataErrorType,
  MetadataWarning,
  WaitingQueueItem
} from './metadata';



import {
  BaseProtocolEvents,
  Protocol,
  UtMetadataExtension,
  MetadataExtensionEvents
} from './protocol';

// 重新导出核心类型以确保向后兼容性
export {
  Peer,
  Node,
  BaseDHTConfig,
  DHTOptions,
  DHTMessage,
  DHTReply,
  StartEvent,
  Metadata,

  MetadataWarning,
  WaitingQueueItem,
  ErrorType,
  ErrorSeverity,
  AppError,
  NetworkError,
  DHTError,
  MetadataErrorFromError as MetadataError,
  CacheError,
  ConfigError,
  ValidationError,
  SystemError,
  BaseProtocolEvents,
  Protocol,
  UtMetadataExtension,
  MetadataExtensionEvents
};

// 常用事件类型
export interface DHTEvents {
  start: (config: StartEvent) => void;
  node: (node: Node) => void;
  warning: (err: Error) => void;
  error: (err: Error) => void;
  listening: () => void;
  close: () => void;
}

export interface MetadataEvents {
  metadata: (metadata: Metadata) => void;
  warning: (err: Error | string, infoHash?: Buffer, peer?: Peer) => void;
  done: () => void;
}