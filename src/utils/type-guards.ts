import { ExtendedWire, ProtocolWithExtensions } from '../types';

/**
 * 类型守卫函数：检查wire对象是否支持ut_metadata扩展
 */
export function isWireWithUtMetadata(wire: any): wire is ExtendedWire {
    return wire && 
           typeof wire.on === 'function' && 
           typeof wire.extended === 'function' &&
           (wire.ut_metadata !== undefined);
}

/**
 * 类型守卫函数：检查对象是否为有效的Protocol实例
 */
export function isProtocolInstance(obj: any): obj is ProtocolWithExtensions {
    return obj && 
           typeof obj.use === 'function' && 
           typeof obj.handshake === 'function' &&
           typeof obj.extended === 'function' &&
           typeof obj.on === 'function' &&
           typeof obj.pipe === 'function';
}