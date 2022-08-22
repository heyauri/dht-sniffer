# dht-sniffer

## Introduction
A nodejs based dht-sniffer, including a metadata(torrent) fetching module.

## Usage
```nodejs
const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");

let sniffer = new DHTSniffer({ port: 6881, refreshTime: 30000 });
sniffer.start();

// "infoHash" event will fire when the sniffer get a infoHash
sniffer.on('infoHash', data => {
    console.log('get infoHash:', data, data["infoHash"].toString("hex"));
    // can be removed, fetch the metadata of the target infoHash
    sniffer.fetchMetaData(data['infoHash'], data['peer']);
});

// "metadata" event will fire when the sniffer fetch the target metadata successfully
sniffer.on("metadata", data => {
    console.log("success", data["infoHash"], data["metadata"]);
    try{
        fs.writeFileSync(path.join(__dirname,"../tors/",`${data["infoHash"].toString("hex")}.torrent`),data["metadata"]);
    }catch(e){
        fs.writeFileSync(path.join(__dirname,`${data["infoHash"].toString("hex")}.torrent`),data["metadata"]);
    }
})

sniffer.on('warning', err => {
    console.error(err);
});
sniffer.on('error', err => {
    console.error(err);
});
sniffer.on("metadataError", data => {
    console.error("fail", data["infoHash"], data["error"]);
})

```
