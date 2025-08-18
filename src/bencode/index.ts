// "bencode": "^4.0.0", 
import encode from './encode'
import decode from './decode'
import byteLength from './encoding-length'
/**
 * Determines the amount of bytes
 * needed to encode the given value
 * @param  {Object|Array|Uint8Array|String|Number|Boolean} value
 * @return {Number} byteCount
 */
const encodingLength = byteLength
export default { encode, decode, byteLength, encodingLength }
