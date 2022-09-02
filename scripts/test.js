const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");
// const heapdump = require("heapdump");

let sniffer = new DHTSniffer({ port: 6881, maximumWaitingQueueSize: 300, refreshTime: 30000, downloadMaxTime: 30000, aggressive: false });
sniffer.start();
sniffer.on('infoHash', (infoHash, peer) => {
    // console.log('get infoHash:', infoHash, peer);
    if (!fs.existsSync(path.join(__dirname, "../tors/", `${infoHash.toString("hex")}.torrent`))) {
        sniffer.fetchMetaData(infoHash, peer);
        sniffer.getSizes();
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
    // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timpstamp + '.heapsnapshot'));
}, 10 * 60 * 1000)
