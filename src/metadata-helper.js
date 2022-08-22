const utils = require("./utils");
const net = require('net');
const ut_metadata = require('ut_metadata');
const Protocol = require('bittorrent-protocol');
const bencode = require("bencode");

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


export function parseMetaData(metadata) {
    try {
        let data = bencode.decode(metadata);
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}
