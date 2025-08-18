const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");
// const heapdump = require("heapdump");

let sniffer = new DHTSniffer(
    {
        port: 6881, maximumParallelFetchingTorrent: 40, maximumWaitingQueueSize: -1, refreshTime: 30000, downloadMaxTime: 20000, expandInfoHash: false, fetchedTupleSize: 100000, ignoreFetched: true, fetchedInfoHashSize: 100000, findNodeCacheSize: 100000, aggressiveLevel: 0
    });
sniffer.start();
sniffer.on("start", infos => {
    console.log(infos);
})
sniffer.on('infoHash', (infoHash, peer) => {
    // console.log('get infoHash:', infoHash, peer);
    if (!fs.existsSync(path.join(__dirname, "../tors/", `${infoHash.toString("hex")}.torrent`))) {
        sniffer.fetchMetaData(infoHash, peer, true);
        console.log(JSON.stringify(sniffer.getStats()));
    }
});
sniffer.on('node', node => {
    console.log('find node', node);
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

let usefulPeerDict = fs.existsSync("../useful-peers.json") ? require("../useful-peers.json") : {};

for (let peer of Object.values(usefulPeerDict)) {
    sniffer.importPeer(peer);
}

setInterval(() => {
    console.log(JSON.stringify(sniffer.getStats()));
    let usefulPeers = sniffer.exportPeers();
    for (let peer of usefulPeers) {
        let peerKey = `${peer.host}:${peer.port}`;
        if (!Reflect.has(usefulPeerDict, peerKey)) {
            usefulPeerDict[peerKey] = {
                host: peer.host, port: peer.port, value: 1, lastSeen: timestamp
            }
        }
        if (usefulPeerDict[peerKey].lastSeen !== timestamp) {
            usefulPeerDict[peerKey]["value"] += 1;
            usefulPeerDict[peerKey].lastSeen = timestamp;
        }
    }
    let now = new Date().getTime();
    for (let key in usefulPeerDict) {
        let peer = usefulPeerDict[key];
        if (peer.value == 1 && now - peer.lastSeen > 60 * 86400 * 1000) {
            Reflect.deleteProperty(usefulPeerDict, key);
        }
    }
    fs.writeFileSync(path.join(__dirname, "../useful-peers.json"), JSON.stringify(usefulPeerDict));
}, 60 * 1000)

setInterval(() => {
    // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timestamp + '.heapsnapshot'));
    console.log(JSON.stringify(sniffer.getStats()));
}, 60 * 1000)

let tmp_fp = path.join(__dirname, "../tmp/arr")
process.on("SIGINT", () => {
    let arr = sniffer.exportWaitingQueue();
    let json = JSON.stringify(arr);
    if (arr.length > 0) {
        fs.writeFileSync(tmp_fp, json);
    }
    process.exit();
});

try {
    if (fs.existsSync(tmp_fp)) {
        let s = fs.readFileSync(tmp_fp).toString();
        let arr = JSON.parse(s);
        sniffer.importWaitingQueue(arr);
    } else {
        console.log(tmp_fp, "not exist")
    }
} catch (e) {
    console.error(e);
}
