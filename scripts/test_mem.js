const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");
const heapdump = require("heapdump");

let sniffer = new DHTSniffer(
    {
        port: 6881, maximumParallelFetchingTorrent: 30
        , maximumWaitingQueueSize: -1, refreshTime: 30000, downloadMaxTime: 10000, aggressive: false, fetchdTupleSize: 100000, ignoreFetched: true, fetchdInfoHashSize: 100000, findNodeCacheSize: 100000
    });
sniffer.start();
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

let timpstamp = Date.now();

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

setInterval(() => {
    console.log(Object.values(sniffer.getSizes()).join(" "));
}, 60 * 1000)

setInterval(() => {
    heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timpstamp + '.heapsnapshot'));
}, 600 * 1000)