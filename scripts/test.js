const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");
// const heapdump = require("heapdump");

let sniffer = new DHTSniffer(
    {
        port: 6881, maximumParallelFetchingTorrent: 30, maximumWaitingQueueSize: -1, refreshTime: 30000, downloadMaxTime: 20000, aggressive: false, fetchedTupleSize: 100000, ignoreFetched: true, fetchedInfoHashSize: 100000, findNodeCacheSize: 100000
    });
sniffer.start();
sniffer.on("start", infos => {
    console.log(infos);
})
sniffer.on('infoHash', (infoHash, peer) => {
    // console.log('get infoHash:', infoHash, peer);
    if (!fs.existsSync(path.join(__dirname, "../tors/", `${infoHash.toString("hex")}.torrent`))) {
        sniffer.fetchMetaData(infoHash, peer, true);
        console.log(Object.values(sniffer.getSizes()).join(" "));
    }
});
sniffer.on('node', node => {
    // console.log('find node', node);
});
sniffer.on('warning', err => {
    // console.error(err);
});
sniffer.on('error', err => {
    // console.error(err);
});

let timestamp = Date.now();

sniffer.on("metadata", (infoHash, metadata) => {
    console.log("success", infoHash, metadata);
    try {
        fs.writeFileSync(path.join(__dirname, "../tors/", `${infoHash.toString("hex")}.torrent`), metadata);
        // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timpstamp + '.heapsnapshot'));
    } catch (e) {
        console.error(e);
        // fs.writeFileSync(path.join(__dirname, `${infoHash.toString("hex")}.torrent`), metadata);
    }
})
sniffer.on("metadataError", data => {
    // console.error("fail", data["infoHash"], data["error"]);
})

let userfulPeerDict = require("../useful-peers.json");

for (let peer of Object.values(userfulPeerDict)) {
    sniffer.importPeer(peer);
}

setInterval(() => {
    console.log(Object.values(sniffer.getSizes()).join(" "));
    let usefulPeers = sniffer.exportUsefulPeers();
    for (let peer of usefulPeers) {
        let peerKey = `${peer.host}:${peer.port}`;
        if (!Reflect.has(userfulPeerDict, peerKey)) {
            userfulPeerDict[peerKey] = {
                host: peer.host, port: peer.port, value: 1, lastSeen: timestamp
            }
        }
        if (userfulPeerDict[peerKey].lastSeen !== timestamp) {
            userfulPeerDict[peerKey]["value"] += 1;
            userfulPeerDict[peerKey].lastSeen = timestamp;
        }
    }
    let now = new Date().getTime();
    for (let key in userfulPeerDict) {
        let peer = userfulPeerDict[key];
        if (peer.value == 1 && now - peer.lastSeen > 60 * 86400 * 1000) {
            Reflect.deleteProperty(userfulPeerDict, key);
        }
    }
    fs.writeFileSync(path.join(__dirname, "../useful-peers.json"), JSON.stringify(userfulPeerDict));
}, 60 * 1000)

setInterval(() => {
    // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timestamp + '.heapsnapshot'));
    console.log(Object.values(sniffer.getSizes()).join(" "));
}, 60 * 1000)
