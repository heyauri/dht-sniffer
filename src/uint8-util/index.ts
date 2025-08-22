import { createHash, randomBytes as rand, BinaryToTextEncoding } from 'node:crypto'

const decoder = new TextDecoder()
export const arr2text = (data: Uint8Array, enc?: string): string => {
  if (data.byteLength > 1024) {
    if (!enc) return decoder.decode(data)
    const dec = new TextDecoder(enc)
    return dec.decode(data)
  }
  return Buffer.from(data).toString(enc as BufferEncoding || 'utf8')
}

export const text2arr = (str: string): Uint8Array => new Uint8Array(Buffer.from(str, 'utf8'))

export const arr2base = (data: Uint8Array): string => Buffer.from(data).toString('base64')

export const base2arr = (str: string): Uint8Array => new Uint8Array(Buffer.from(str, 'base64'))

export const hex2bin = (hex: string): string => Buffer.from(hex, 'hex').toString('binary')

export const bin2hex = (bin: string): string => Buffer.from(bin, 'binary').toString('hex')

export const hash = async (data: Uint8Array, format?: string, algo = 'sha1'): Promise<Uint8Array | Buffer> => {
  algo = algo.replace('sha-', 'sha')
  const out = createHash(algo).update(data)
  return format ? new Uint8Array(Buffer.from(out.digest(format as BinaryToTextEncoding), 'hex').buffer) : new Uint8Array(out.digest().buffer)
}

export const randomBytes = (size: number): Uint8Array => {
  return new Uint8Array(rand(size))
}

export * from './util.js'
