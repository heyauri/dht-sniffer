/**
 * 协议扩展相关类型定义
 */

import { EventEmitter } from 'events';

/**
 * 基础协议事件接口
 */
export interface BaseProtocolEvents {
  handshake: (infoHash: Buffer, peerId: Buffer, extensions: any) => void;
  extended: (extension: string, data: any) => void;
  choke: () => void;
  unchoke: () => void;
  interested: () => void;
  uninterested: () => void;
  have: (index: number) => void;
  bitfield: (bitfield: Buffer) => void;
  request: (index: number, offset: number, length: number) => void;
  piece: (index: number, offset: number, buffer: Buffer) => void;
  cancel: (index: number, offset: number, length: number) => void;
  port: (port: number) => void;
  timeout: () => void;
  close: () => void;
  error: (error: Error) => void;
}

/**
 * 协议类扩展声明
 */
export declare class Protocol extends EventEmitter {
  on<U extends keyof BaseProtocolEvents>(event: U, listener: BaseProtocolEvents[U]): this;
  emit<U extends keyof BaseProtocolEvents>(event: U, ...args: Parameters<BaseProtocolEvents[U]>): boolean;
  
  handshake(infoHash?: Buffer, peerId?: Buffer, extensions?: any): void;
  extended(extension: string, data: any): void;
  choke(): void;
  unchoke(): void;
  interested(): void;
  uninterested(): void;
  have(index: number): void;
  bitfield(bitfield: Buffer): void;
  request(index: number, offset: number, length: number): void;
  piece(index: number, offset: number, buffer: Buffer): void;
  cancel(index: number, offset: number, length: number): void;
  port(port: number): void;
  timeout(): void;
  close(): void;
  destroy(): void;
}

/**
 * UtMetadata扩展接口
 */
export interface UtMetadataExtension {
  name: string;
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  request(piece: number): void;
  data(piece: number, buffer: Buffer): void;
  reject(piece: number): void;
  cancel(): void;
}

/**
 * 元数据扩展事件接口
 */
export interface MetadataExtensionEvents {
  metadata: (metadata: Buffer, infoHash: Buffer) => void;
  warning: (err: Error | string, infoHash?: Buffer, peer?: any) => void;
  done: () => void;
}

/**
 * 扩展消息接口
 */
export interface ExtensionMessage {
  type: number;
  payload: any;
}

/**
 * 握手消息接口
 */
export interface HandshakeMessage {
  protocol: string;
  extensions: number;
  infoHash: Buffer;
  peerId: Buffer;
}

/**
 * 扩展握手消息接口
 */
export interface ExtendedHandshakeMessage {
  m: {
    ut_metadata?: number;
    ut_pex?: number;
    [key: string]: number | undefined;
  };
  metadata_size?: number;
  yourip?: Buffer;
  reqq?: number;
  v?: string;
}

/**
 * 元数据请求消息接口
 */
export interface MetadataRequestMessage {
  type: 0;
  piece: number;
}

/**
 * 元数据数据消息接口
 */
export interface MetadataDataMessage {
  type: 1;
  piece: number;
  totalSize?: number;
}

/**
 * 元数据拒绝消息接口
 */
export interface MetadataRejectMessage {
  type: 2;
  piece: number;
}

/**
 * 扩展类型联合
 */
export type ExtensionMessageType = 
  | MetadataRequestMessage
  | MetadataDataMessage
  | MetadataRejectMessage;

/**
 * 协议扩展配置接口
 */
export interface ProtocolExtensionConfig {
  enableUtMetadata?: boolean;
  enableUtPex?: boolean;
  enableDht?: boolean;
  enableLtep?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * 扩展状态接口
 */
export interface ExtensionState {
  enabled: boolean;
  supported: boolean;
  handshakeReceived: boolean;
  handshakeSent: boolean;
  lastActivity?: number;
  errorCount: number;
}

/**
 * 扩展Wire接口
 */
export interface ExtendedWire {
  ut_metadata?: UtMetadataExtension;
  extended(ext: string | number, obj: any): void;
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}

/**
 * 带扩展的协议接口
 */
export interface ProtocolWithExtensions extends Protocol {
  ut_metadata?: UtMetadataExtension;
  extended(ext: string | number, obj: any): void;
}

/**
 * UtMetadata工厂接口
 */
export interface UtMetadataFactory {
  (wire: ExtendedWire, options?: any): UtMetadataExtension;
}

/**
 * 类型守卫函数
 */
export function isWireWithUtMetadata(wire: any): wire is ExtendedWire & { ut_metadata: UtMetadataExtension } {
  return wire && typeof wire.ut_metadata !== 'undefined';
}

export function isProtocolInstance(obj: any): obj is Protocol {
  return obj && typeof obj.handshake === 'function' && typeof obj.extended === 'function';
}