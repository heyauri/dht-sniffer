/**
 * 协议扩展类型定义文件
 * 
 * 本文件从统一的types/protocol.ts导入所有协议相关类型定义
 * 以避免重复定义并保持类型的一致性
 */

// 导入统一的类型定义
import {
  BaseProtocolEvents,
  UtMetadataExtension,
  ExtendedWire,
  UtMetadataFactory,
  ProtocolWithExtensions,
  isWireWithUtMetadata,
  isProtocolInstance
} from './protocol';

// 重新导出类型以保持向后兼容性
export {
  BaseProtocolEvents,
  UtMetadataExtension,
  ExtendedWire,
  UtMetadataFactory,
  ProtocolWithExtensions,
  isWireWithUtMetadata,
  isProtocolInstance
};

// 扩展bittorrent-protocol的Protocol类
declare module '../bittorrent-protocol' {
    interface Protocol {
        // ut_metadata扩展属性
        ut_metadata?: UtMetadataExtension;
        
        // 扩展方法
        extended(ext: string | number, obj: any): void;
        
        // 扩展事件监听器
        on<K extends keyof BaseProtocolEvents>(event: K, listener: (...args: Parameters<BaseProtocolEvents[K]>) => void): this;
        
        // 保留原有的事件监听器
        on(event: string, listener: (...args: any[]) => void): this;
    }
}

// 扩展全局的ut_metadata模块
declare module './ut_metadata' {
    const ut_metadata: UtMetadataFactory;
    export default ut_metadata;
}