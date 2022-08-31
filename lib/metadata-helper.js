"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMetaData = exports.fetch = void 0;
const utils = require("./utils");
const net = require('net');
const ut_metadata = require('ut_metadata');
const Protocol = require('bittorrent-protocol');
const bencode = require("bencode");
const crypto = require('crypto');
function fetch(target, config) {
    return new Promise((resolve, reject) => {
        let peer = target.peer;
        let infoHash = target.infoHash;
        const socket = net.createConnection(peer.port, peer.address);
        socket.setTimeout(config.downloadMaxTime || 30000);
        socket.on('connect', () => {
            const wire = new Protocol();
            socket.pipe(wire).pipe(socket);
            wire.use(ut_metadata());
            wire.handshake(infoHash, utils.getRandomId());
            wire.ut_metadata.on('metadata', metadata => {
                console.log("success", metadata);
                resolve(metadata);
                socket.end();
            });
            wire.ut_metadata.on('warning', err => {
                reject({ type: "metadataWarning", err });
            });
            wire.on('handshake', (infoHash, peerId) => {
                wire.ut_metadata.fetch();
            });
        });
        socket.on('error', function (err) {
            socket.destroy();
            reject({ type: "socketError", err });
        });
        socket.on('timeout', function (err) {
            socket.destroy();
            reject({ type: "timeout", err });
        });
        socket.once('close', function (hadError) {
            if (hadError) {
                reject({ type: "socketError", hadError });
            }
            else {
                resolve();
            }
        });
    });
}
exports.fetch = fetch;
function parseMetaData(rawMetadata) {
    let metadata = bencode.decode(rawMetadata);
    let infoHash = crypto.createHash('sha1').update(bencode.encode(metadata["info"])).digest();
    let torrentType = "single";
    let filePaths = [];
    let size = 0;
    if (Object.prototype.toString.call(metadata.info.files) === "[object Array]") {
        torrentType = "multiple";
        let arr = [];
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
            }
            catch (e) {
            }
        }
        filePaths = arr;
    }
    else if (metadata.info.files) {
        if (metadata.info.files['path']) {
            filePaths = metadata.info.files['path'].toString();
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
        torrentType,
        filePaths,
        info: metadata.info,
        rawMetadata
    };
}
exports.parseMetaData = parseMetaData;
