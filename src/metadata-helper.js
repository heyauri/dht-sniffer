const utils = require("./utils");
const net = require('net');
const ut_metadata = require('ut_metadata');
const Protocol = require('bittorrent-protocol');
const bencode = require("bencode");
const crypto = require('crypto');

export function fetch(target, config) {
    return new Promise((resolve, reject) => {
        // console.log('try fetching metadata', target);
        let peer = target.peer;
        let infoHash = target.infoHash;
        const socket = net.createConnection(peer.port, peer.address)
        socket.setTimeout(config.downloadMaxTime || 30000);
        socket.on('connect', () => {
            const wire = new Protocol()
            socket.pipe(wire).pipe(socket)
            // initialize the extension
            wire.use(ut_metadata())
            // all `ut_metadata` functionality can now be accessed at wire.ut_metadata
            // handshake
            wire.handshake(infoHash, utils.getRandomId());
            // 'metadata' event will fire when the metadata arrives and is verified to be correct!
            wire.ut_metadata.on('metadata', metadata => {
                console.log("success", metadata);
                resolve(metadata);
                socket.end();
            })

            // optionally, listen to the 'warning' event if you want to know that metadata is
            // probably not going to arrive for one of the above reasons.
            wire.ut_metadata.on('warning', err => {
                reject({ type: "metadataWarning", err });
            })

            // handle handshake
            wire.on('handshake', (infoHash, peerId) => {
                // ask the peer to send us metadata
                wire.ut_metadata.fetch()
            })
        });

        socket.on('error', function (err) {
            socket.destroy();
            reject({ type: "socketError", err });
        });

        socket.on('timeout', function (err) {
            socket.destroy();
            reject({ type: "timeout", err });
        });

        socket.once('close', function () {
            //ignore
        });
    });
}


export function parseMetaData(rawMetadata) {
    let metadata = bencode.decode(rawMetadata);
    // metadata from bittorrent-protocol pkg is slightly different from the original
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
            } catch (e) {
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

    filePaths = JSON.stringify(filePaths);
    return {
        infoHash,
        name: metadata.info.name.toString(),
        size: size,
        torrentType: torrentType,
        filePaths: filePaths,
        info: metadata.info,
        rawMetadata
    };
}
