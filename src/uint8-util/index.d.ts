/**
 * Uint8工具类型定义文件
 * 
 * 本文件从统一的types/utils.ts导入所有工具相关类型定义
 * 以避免重复定义并保持类型的一致性
 */

// 导入统一的类型定义
import {
  TypedArray,
  Encoding,
  HashType,
  HashAlgo,
  Uint8,
  Hex,
  Base64
} from '../types/utils';

// 重新导出类型以保持向后兼容性
export {
  TypedArray,
  Encoding,
  HashType,
  HashAlgo,
  Uint8,
  Hex,
  Base64
};

/**
 * 连接多个TypedArray或数组
 */
export function concat (chunks: (TypedArray | Array<number>)[], size?: number): Uint8Array;

/**
 * 比较两个Uint8数组是否相等
 */
export function equal (a: Uint8, b: Uint8): boolean;

/**
 * 将Uint8数组转换为十六进制字符串
 */
export function arr2hex (data: Uint8): Hex;

/**
 * 将十六进制字符串转换为Uint8数组
 */
export function hex2arr (str: Hex): Uint8Array;

/**
 * 将ArrayBuffer或Uint8数组转换为文本
 */
export function arr2text (data: ArrayBuffer | Uint8Array, enc?: Encoding): string;

/**
 * 将Uint8数组转换为Base64字符串
 */
export function arr2base (data: Uint8): Base64;

/**
 * 将Base64字符串转换为Uint8数组
 */
export function base2arr (str: Base64): Uint8Array;

/**
 * 将文本转换为Uint8数组
 */
export function text2arr (str: string): Uint8Array;

/**
 * 将十六进制字符串转换为二进制字符串
 */
export function hex2bin (str: Hex): string;

/**
 * 将二进制字符串转换为十六进制字符串
 */
export function bin2hex (str: string): Hex;

/**
 * 计算数据的哈希值
 */
export function hash (data: string | TypedArray | ArrayBuffer | DataView, format?: HashType, algo?: HashAlgo): Promise<Uint8Array | Hex | Base64>;

/**
 * 生成随机字节
 */
export function randomBytes (size: number): Uint8Array;
