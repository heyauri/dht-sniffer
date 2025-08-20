/**
 * 数组工具函数
 */

/**
 * 随机打乱数组
 * @param array 要打乱的数组
 * @returns 打乱后的数组
 */
export function shuffle<T>(array: T[]): T[] {
    const length = array == null ? 0 : array.length;
    if (!length) {
        return [];
    }
    let index = -1;
    const lastIndex = length - 1;
    const result = array;
    while (++index < length) {
        const rand = index + Math.floor(Math.random() * (lastIndex - index + 1));
        const tmp = result[rand];
        result[rand] = result[index];
        result[index] = tmp;
    }
    return result;
}