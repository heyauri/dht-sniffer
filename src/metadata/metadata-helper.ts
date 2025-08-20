import { getRandomId } from "../utils/dht-utils";
import * as net from 'net';
import ut_metadata from './ut_metadata';
import Protocol from '../bittorrent-protocol';
import * as bencode from '../bencode';
import * as crypto from 'crypto';
import { NetworkError, TimeoutError, MetadataError, ErrorType, ErrorSeverity } from '../errors/error-types';
import { Peer, ParsedMetadata } from '../types';

export interface MetadataFetchTarget {
  infoHash: Buffer;
  peer: Peer;
}

export interface MetadataFetchConfig {
  downloadMaxTime?: number;
}

export function fetch(target: MetadataFetchTarget, config: MetadataFetchConfig): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // console.log('try fetching metadata', target);
        let peer = target.peer;
        let infoHash = target.infoHash;
        const socket = net.createConnection(peer.port, peer.host || peer.address)
        socket.setTimeout(config.downloadMaxTime || 30000);
        socket.on('connect', () => {
            const wire = new Protocol() as any;
            socket.pipe(wire as any).pipe(socket)
            // initialize the extension
            wire.use(ut_metadata(wire))
            // all `ut_metadata` functionality can now be accessed at wire.ut_metadata
            // handshake
            wire.handshake(infoHash, getRandomId());
            // 'metadata' event will fire when the metadata arrives and is verified to be correct!
            (wire as any).ut_metadata.on('metadata', (metadata: Buffer) => {
                resolve(metadata);
                socket.end();
                wire.destroy();
            })

            // optionally, listen to the 'warning' event if you want to know that metadata is
            // probably not going to arrive for one of the above reasons.
            (wire as any).ut_metadata.on('warning', (err: any) => {
                reject(new MetadataError(
                    `Metadata warning: ${err.message || err}`,
                    {
                        operation: 'metadata_fetch',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex')
                    },
                    true
                ));
                wire.destroy();
            })

            // handle handshake
            wire.on('handshake', (infoHash: Buffer, peerId: Buffer) => {
                // ask the peer to send us metadata
                (wire as any).ut_metadata.fetch()
            })
        });

        socket.on('error', function (err: Error) {
            socket.destroy();
            reject(new NetworkError(
                `Socket error: ${err.message || err}`,
                {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex')
                },
                true
            ));
        });

        socket.on('timeout', function () {
            socket.destroy();
            reject(new TimeoutError(
                `Connection timeout to ${peer.host}:${peer.port}`,
                {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex'),
                    timeoutMs: config.downloadMaxTime || 30000
                }
            ));
        });

        socket.once('close', function (hadError: boolean) {
            //ignore
            if (hadError) {
                reject(new NetworkError(
                    'Socket closed with error',
                    {
                        operation: 'socket_close',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex'),
                        hadError: true
                    },
                    true
                ));
            } else {
                resolve(Buffer.from('success'));
            }
        });
    });
}


export function parseMetaData(rawMetadata: Buffer): ParsedMetadata {
    let metadata = (bencode as any).decode(rawMetadata) as any;
    // metadata from bittorrent-protocol pkg is slightly different from the original
    let infoHash = crypto.createHash('sha1').update((bencode as any).encode(metadata["info"])).digest();
    let torrentType = "single";
    let filePaths: string[] = [];
    let size = 0;
    if (Object.prototype.toString.call(metadata.info.files) === "[object Array]") {
        torrentType = "multiple";
        let arr: string[] = [];
        for (let item of metadata.info.files) {
            try {
                if (item['path']) {
                    let str = item['path'].toString();
                    if (str !== '') {
                        arr.push(str);
                    }
                }
                if (item['length']) {
                    size += item['length'];
                }
            } catch (e) {
            }
        }
        filePaths = arr;
    }
    else if (metadata.info.files) {
        if (metadata.info.files['path']) {
            filePaths = [metadata.info.files['path'].toString()];
        }
    }
    else if (!metadata.info.files && metadata.info["length"]) {
        size = metadata.info.length;
        filePaths.push(metadata.info.name.toString());
    }

    return {
        infoHash,
        name: metadata.info.name.toString(),
        size,
        torrentType: torrentType as 'single' | 'multiple',
        filePaths,
        info: metadata.info,
        rawMetadata
    };
}
