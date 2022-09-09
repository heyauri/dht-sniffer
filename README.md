# dht-sniffer

## Introduction
A nodejs based dht-sniffer, including a metadata(torrent) module that can be used to fetch and parse matadata.

## Example
```js
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
## API

### `sniffer.start()`
Starting to sniffe infoHash from the DHT network, should be called after the initialization of the service.

### `sniffer.stop()`
Stop the sniffe service and destroy the inner DHT instance.

### `sniffer.fetchMetaData(target)`
Fetch the target metadata from the target peer.
```js
sniffer.fetchMetaData({
    infoHash:Buffer,
    peer:{
        address: any //target ip address,
        port: any //target port number
    }
})
```

### `sniffer.parseMetaData(rawMetadata)`
Parse the raw metadata to a object with the following properties:
```js
{
        infoHash,// Buffer like infoHash
        name, // the name of the metadata
        size, // total size of the files
        torrentType, // 'single' or 'multiple' files
        filePaths, // a list of all files
        info: metadata.info,
        rawMetadata
}
```

## Events

### `dht.on('infoHash',function(infoHash,peer){ ... })`
Emitted when the "get_peers" message is received, the message consists of an infoHash Buffer data and the remote peer which sent the "get_peers" message, be like { address, port }.

### `dht.on('metadata',function(infoHash,metadata){ ... })`
Emitted when the service fetched target metadata successfully. The `metadata` argument is a buffer that can be saved as a torrent file directly. Besides the `metadata` argument can also be parsed into an object using the `parseMetaData` function.

### `dht.on('metadataError',function(err){ ... })`
Emitted when the service encounter an error during the metadata fetching progress.


## Options

### port
The port number of the DHTSniffer service. Default is 6881.

### refreshTime
If the sniffer have not received any message from the DHT network during a time period, if will sent the `find_node` message to other nodes. By default the refreshTime is set to 1 minute, i.e. 1*60*1000 ms.

### maximumParallelFetchingTorrent
Because every metadata request will last for seconds, the service will fetch meatadata parallelly. This option is used to limit the number of the parallel requests. Default value is 16.

### maximumWaitingQueueSize
While there is more than 25 (or your setting value) metadata requests, the call of `sniffer.fetchMetaData` function will be put into a waiting queue. This option is to set the size of the waiting queue. Default value is -1 which means no limit.

### downloadMaxTime
If the pending request exceeds this value, it will time out. Default value is 30*1000 ms.

### aggressive
Boolean value. If true, the service will look for other nodes very aggressive. Default value is false.

### ignoreFetched
Boolean value. If true, the service will ignore fetched requests this are still kept in the fetched cache. Default value is true.

### concurrency
The number of concurrent requests of the DHT service, mainly related to the `find_node` requests. Default value is 16, and it is enough under most circumstances.

### fetchdTupleSize
The size of the internal LRU cache `fetchdTupleSize` which will store the tuple like `{infoHash, peer}`. While the `ignoreFetched` option is set to `true` and the tuple is still kept in cache, the metadata fetching requests will be ignored.
