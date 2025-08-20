import * as crypto from 'crypto';

/**
 * 生成随机ID
 */
export function getRandomId(): Buffer {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
}

/**
 * 获取邻居节点ID
 * @param target 目标ID
 * @param nid 节点ID
 * @returns 邻居节点ID
 */
export function getNeighborId(target: Buffer, nid: Buffer): Buffer {
    return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
}

/**
 * 解析IP地址
 * @param buf 缓冲区
 * @param offset 偏移量
 * @returns IP地址字符串
 */
function parseIp(buf: Buffer, offset: number): string {
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++];
}

/**
 * 检查是否为有效的节点ID
 * @param id 节点ID
 * @param idLength ID长度
 * @returns 是否为有效的节点ID
 */
export function isNodeId(id: Buffer, idLength: number): boolean {
    return id && Buffer.isBuffer(id) && id.length === idLength;
}

/**
 * 解析节点信息
 * @param buf 缓冲区
 * @param idLength ID长度
 * @returns 节点信息数组
 */
export function parseNodes(buf: Buffer, idLength: number): Array<{
    id: Buffer;
    host: string;
    port: number;
    distance: number;
    token: string | null;
}> {
    const pNodes = [];
    try {
        for (let i = 0; i < buf.length; i += (idLength + 6)) {
            const port = buf.readUInt16BE(i + (idLength + 4));
            if (!port) continue;
            pNodes.push({
                id: buf.slice(i, i + idLength),
                host: parseIp(buf, i + idLength),
                port: port,
                distance: 0,
                token: null
            });
        }
    } catch (err) {
        // do nothing
    }
    return pNodes;
}

/**
 * 获取节点的键值
 * @param peer 节点信息
 * @returns 节点键值
 */
export function getPeerKey(peer: { host: string; port: number }): string {
    return `${peer.host}:${peer.port}`;
}