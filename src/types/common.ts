/**
 * 基础类型定义
 */

/**
 * 通用回调函数类型
 */
export type Callback<T = void> = (error: Error | null, result?: T) => void;

/**
 * 异步函数类型
 */
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (event: T) => void;

/**
 * 错误处理函数类型
 */
export type ErrorHandler = (error: Error) => void;

/**
 * 配置验证函数类型
 */
export type ConfigValidator<T = any> = (config: T) => boolean | string;

/**
 * 可选配置接口
 */
export interface OptionalConfig {
  [key: string]: unknown;
}

/**
 * 位置信息接口
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * 范围接口
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * 版本信息接口
 */
export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * 统计信息接口
 */
export interface Stats {
  count: number;
  total: number;
  average?: number;
  min?: number;
  max?: number;
}

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    user: number;
    system: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  disk?: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
}

/**
 * 状态接口
 */
export interface Status {
  code: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 结果接口
 */
export interface Result<T = any, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
  message?: string;
}

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 过滤选项接口
 */
export interface FilterOptions {
  include?: string[];
  exclude?: string[];
  where?: Record<string, unknown>;
  search?: string;
}

/**
 * 排序选项接口
 */
export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * 查询选项接口
 */
export interface QueryOptions extends PaginationOptions, FilterOptions {
  sort?: SortOptions[];
}

/**
 * 时间范围接口
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * 进度信息接口
 */
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  speed?: number;
  eta?: number;
  startedAt: number;
  updatedAt: number;
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * 任务接口
 */
export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  progress?: ProgressInfo;
  result?: Result;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * 任务队列接口
 */
export interface TaskQueue {
  add(task: Task): void;
  remove(taskId: string): boolean;
  get(taskId: string): Task | undefined;
  list(): Task[];
  clear(): void;
  size(): number;
  next(): Task | undefined;
}

/**
 * 通用事件接口
 */
export interface GenericEvents {
  [event: string]: (...args: any[]) => void;
}

/**
 * 可观察对象接口
 */
export interface Observable<T = any> {
  subscribe(observer: (value: T) => void): () => void;
  unsubscribe(): void;
  next(value: T): void;
  error(error: Error): void;
  complete(): void;
}

/**
 * 可取消接口
 */
export interface Cancelable {
  cancel(): void;
  isCanceled(): boolean;
}

/**
 * 可销毁接口
 */
export interface Disposable {
  dispose(): void;
  isDisposed(): boolean;
}

/**
 * 可重置接口
 */
export interface Resetable {
  reset(): void;
}

/**
 * 可配置接口
 */
export interface Configurable<T = any> {
  configure(config: Partial<T>): void;
  getConfig(): T;
}

/**
 * 可验证接口
 */
export interface Validatable {
  validate(): boolean | string[];
  isValid(): boolean;
}