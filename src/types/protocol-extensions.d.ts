import { EventEmitter } from 'events';
import { Duplex } from 'streamx';

// 扩展bittorrent-protocol的Protocol类
declare module '../bittorrent-protocol' {
    interface Protocol {
        // ut_metadata扩展属性
        ut_metadata?: UtMetadataExtension;
        
        // 扩展方法
        extended(ext: string | number, obj: any): void;
        
        // 扩展事件监听器
        on(event: 'metadata', listener: (metadata: Buffer) => void): this;
        on(event: 'warning', listener: (err: Error) => void): this;
        on(event: 'handshake', listener: (infoHash: Buffer, peerId: Buffer) => void): this;
        
        // 保留原有的事件监听器
        on(event: string, listener: (...args: any[]) => void): this;
    }
}

// ut_metadata扩展接口
export interface UtMetadataExtension {
    // 事件
    on(event: 'metadata', listener: (metadata: Buffer) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    
    // 方法
    fetch(): void;
    cancel(): void;
    setMetadata(metadata: Buffer): Promise<boolean>;
}

// 扩展EventEmitter类型以支持ut_metadata事件
export interface UtMetadataEvents {
    metadata: [metadata: Buffer];
    warning: [err: Error];
}

// 扩展Protocol事件类型
export interface ProtocolEvents {
    metadata: [metadata: Buffer];
    warning: [err: Error];
    handshake: [infoHash: Buffer, peerId: Buffer];
}

// 扩展Wire类（如果需要）
export interface ExtendedWire extends Duplex {
    ut_metadata?: UtMetadataExtension;
    extended(ext: string | number, obj: any): void;
    
    // 事件监听器
    on(event: 'metadata', listener: (metadata: Buffer) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    on(event: 'handshake', listener: (infoHash: Buffer, peerId: Buffer) => void): this;
    
    // 保留原有的事件监听器
    on(event: string, listener: (...args: any[]) => void): this;
}

// 类型守卫函数声明
export function isWireWithUtMetadata(wire: any): wire is ExtendedWire;

// ut_metadata扩展的工厂函数类型
export interface UtMetadataFactory {
    (metadata?: Buffer): UtMetadataExtension;
    prototype: {
        name: 'ut_metadata';
    };
}

// 扩展全局的ut_metadata模块
declare module './ut_metadata' {
    const ut_metadata: UtMetadataFactory;
    export default ut_metadata;
}

// 用于metadata-helper.ts的类型定义
export interface MetadataWireEvents {
    metadata: [metadata: Buffer];
    warning: [err: Error];
    handshake: [infoHash: Buffer, peerId: Buffer];
}

// 扩展Protocol类以支持动态属性
export interface ProtocolWithExtensions {
    // 原有属性（这些属性在wire类中实际存在）
    peerId?: string | null;
    peerIdBuffer?: Buffer | null;
    type?: string | null;
    amChoking?: boolean;
    amInterested?: boolean;
    peerChoking?: boolean;
    peerInterested?: boolean;
    
    // 扩展属性
    ut_metadata?: UtMetadataExtension;
    
    // 方法
    use?(Extension: any): void;
    handshake?(infoHash: Buffer | string, peerId: Buffer | string, extensions?: any): void;
    extended(ext: string | number, obj: any): void;
    
    // 事件监听器
    on(event: 'metadata', listener: (metadata: Buffer) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    on(event: 'handshake', listener: (infoHash: Buffer, peerId: Buffer) => void): this;
    
    // 保留原有的事件监听器
    on(event: string, listener: (...args: any[]) => void): this;
    
    // 流方法
    pipe?<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T;
    
    // 销毁方法
    destroy?(): void;
}

// 类型守卫：检查是否为有效的Protocol实例
export function isProtocolInstance(obj: any): obj is ProtocolWithExtensions;