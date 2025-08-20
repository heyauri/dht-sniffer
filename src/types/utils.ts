/**
 * 工具相关类型定义
 */

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