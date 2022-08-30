const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");

let sniffer = new DHTSniffer({ port: 6881, refreshTime: 30000,downloadMaxTime:30000 });
sniffer.start();
sniffer.on('infoHash', (infoHash,peer) => {
    console.log('get infoHash:', infoHash,peer);
    if(!fs.existsSync(path.join(__dirname,"../tors/",`${data["infoHash"].toString("hex")}.torrent`),data["metadata"])){
        sniffer.fetchMetaData(infoHash, peer);
    }
});
sniffer.on('node', node => {
    // console.log('find node', node);
});
sniffer.on('warning', err => {
    console.error(err);
});
sniffer.on('error', err => {
    console.error(err);
});

sniffer.on("metadata", data => {
    console.log("success", data["infoHash"], data["metadata"]);
    try{
        fs.writeFileSync(path.join(__dirname,"../tors/",`${data["infoHash"].toString("hex")}.torrent`),data["metadata"]);
    }catch(e){
        fs.writeFileSync(path.join(__dirname,`${data["infoHash"].toString("hex")}.torrent`),data["metadata"]);
    }
})
sniffer.on("metadataError", data => {
    console.error("fail", data["infoHash"], data["error"]);
})
