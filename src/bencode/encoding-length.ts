import { text2arr } from '../uint8-util'
import { digitcount, gettype } from './util'

function listLength (list: any[]): number {
  let length = 1 + 1 // type marker + end-of-type marker

  for (const value of list) {
    length += encodingLength(value)
  }

  return length
}

function mapLength (map: Map<any, any>): number {
  let length = 1 + 1 // type marker + end-of-type marker

  for (const [key, value] of map) {
    const keyLength = text2arr(key).byteLength
    length += digitcount(keyLength) + 1 + keyLength
    length += encodingLength(value)
  }

  return length
}

function objectLength (value: Record<string, any>): number {
  let length = 1 + 1 // type marker + end-of-type marker
  const keys = Object.keys(value)

  for (let i = 0; i < keys.length; i++) {
    const keyLength = text2arr(keys[i]).byteLength
    length += digitcount(keyLength) + 1 + keyLength
    length += encodingLength(value[keys[i]])
  }

  return length
}

function stringLength (value: string): number {
  const length = text2arr(value).byteLength
  return digitcount(length) + 1 + length
}

function arrayBufferLength (value: ArrayBuffer): number {
  const length = value.byteLength
  return digitcount(length) + 1 + length
}

function encodingLength (value: any): number {
  const length = 0

  if (value == null) return length

  const type = gettype(value)

  switch (type) {
    case 'arraybufferview': return arrayBufferLength(value)
    case 'string': return stringLength(value)
    case 'array': case 'set': return listLength(value)
    case 'number': return 1 + digitcount(Math.floor(value)) + 1
    case 'bigint': return 1 + value.toString().length + 1
    case 'object': return objectLength(value)
    case 'map': return mapLength(value)
    default:
      throw new TypeError(`Unsupported value of type "${type}"`)
  }
}

export default encodingLength
