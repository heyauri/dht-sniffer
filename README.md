# dht-sniffer

[![npm](https://img.shields.io/npm/v/dht-sniffer.svg?label=&logo=npm)](https://www.npmjs.com/package/dht-sniffer)
[![Node version](https://img.shields.io/node/v/dht-sniffer.svg)](https://www.npmjs.com/package/dht-sniffer)


## Introduction
A Node.js based DHT sniffer, including a metadata (torrent) module that can be used to fetch and parse metadata of torrents.

## Example
```js
const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");

let sniffer = new DHTSniffer({
  address: '0.0.0.0',
  port: 6881,
  nodesMaxSize: 1000,
  refreshPeriod: 30000,
  announcePeriod: 300000,
  maximumParallelFetchingTorrent: 16,
  maximumWaitingQueueSize: -1,
  downloadMaxTime: 30000,
  ignoreFetched: true,
  aggressiveLevel: 0
});
sniffer.start();

// "infoHash" event will fire when the sniffer gets an infoHash
sniffer.on('infoHash', peerInfo => {
  console.log('get infoHash:', peerInfo.infoHash.toString("hex"));
  // Optional: fetch the metadata of the target infoHash
    sniffer.fetchMetaData(peerInfo);
});

// "metadata" event will fire when the sniffer fetches the target metadata successfully
sniffer.on('metadata', metadataInfo => {
    console.log('success', metadataInfo.infoHash.toString('hex'), metadataInfo.metadata);
    try {
        fs.writeFileSync(path.join(__dirname, "../tors/", `${metadataInfo.infoHash.toString("hex")}.torrent`), metadataInfo.metadata);
    } catch (e) {
        fs.writeFileSync(path.join(__dirname, `${metadataInfo.infoHash.toString("hex")}.torrent`), metadataInfo.metadata);
    }
});

sniffer.on('warning', err => {
    console.error(err);
});
sniffer.on('error', err => {
    console.error(err);
});
sniffer.on('metadataError', errorInfo => {
    console.error('fail', errorInfo.infoHash.toString('hex'), errorInfo.error);
});

```
## API

### `sniffer.start()`
Starts sniffing infoHash from the DHT network. Should be called after initializing the service.

### `sniffer.stop()`
Stops the sniff service and destroys the inner DHT instance.

### `sniffer.findNode(target)`
Sends a find_node request to the DHT network to find nodes close to the target. `target` should be a Buffer containing the target node ID.

### `sniffer.getPeers(infoHash)`
Sends a get_peers request to the DHT network to find peers for the given infoHash. `infoHash` should be a Buffer containing the infoHash.

### `sniffer.fetchMetaData(peerInfo)`
Fetches the target metadata from the target peer.
```js
sniffer.fetchMetaData({
    infoHash: Buffer,  // Buffer containing the infoHash
    peer: {
        host: String,  // target IP address
        port: Number   // target port number
    }
});
```

### `sniffer.parseMetaData(rawMetadata)`
Parses the raw metadata to an object with the following properties:
```js
{
    infoHash,     // Buffer containing the infoHash
    name,         // the name of the metadata
    size,         // total size of the files
    torrentType,  // 'single' or 'multiple' files
    filePaths,    // a list of all files
    info: metadata.info,
    rawMetadata
}
```

### `sniffer.exportUsefulPeers()`
Exports useful peers that have successfully provided metadata. In real-world practice, some peers will only send useless infoHashes, whose metadata cannot be fetched from the original source. These peers may also be DHT sniffers, so this sniffer marks those peers that sent useful infoHashes as useful peers. Exporting them and reusing them can help speed up the next execution of the sniffer.

### `sniffer.importPeer(peer)`
Imports a peer. `peer: {host: String, port: Number}`

### `sniffer.exportPeers()`
Exports all known peers from the DHT node.

### `sniffer.importPeers(peers)`
Imports an array of peers. `peers: Array<{host: String, port: Number}>`

### `sniffer.exportWaitingQueue()`
Exports the current waiting queue of metadata requests. Generally, the waiting queue will store many awaiting infoHashes after hours of sniffing. However, if the sniffer is aborted, such in-memory data will be lost. Hence, the `exportWaitingQueue` method is offered to export this data and make the storage of the data available.

### `sniffer.importWaitingQueue(arr)`
Imports an array of waiting queue items. `arr: Array<{infoHash: Buffer, peer: {host: String, port: Number}}>`

### `sniffer.exportNodes()`
Exports all known DHT nodes.

### `sniffer.importNodes(nodes)`
Imports an array of DHT nodes. `nodes: Array<{host: String, port: Number}>`

### `sniffer.getStats()`
Returns statistics about the sniffer's operation.

### `sniffer.isRunningStatus()`
Returns a boolean indicating whether the sniffer is currently running.

### `sniffer.getErrorHandler()`
Returns the error handler instance.

### `sniffer.getErrorMonitor()`
Returns the error monitor instance.

### `sniffer.getCacheManager()`
Returns the cache manager instance.

### `sniffer.getPeerManager()`
Returns the peer manager instance.

### `sniffer.getMetadataManager()`
Returns the metadata manager instance.

### `sniffer.getDHTManager()`
Returns the DHT manager instance.

## Events

### `sniffer.on('infoHash', function(peerInfo) { ... })`
Emitted when the "get_peers" message is received. The `peerInfo` parameter contains:
- `infoHash`: Buffer containing the infoHash
- `peer`: Object with `host` and `port` properties of the remote peer

### `sniffer.on('metadata', function(metadataInfo) { ... })`
Emitted when the service successfully fetches the target metadata. The `metadataInfo` parameter contains:
- `infoHash`: Buffer containing the infoHash
- `metadata`: Buffer that can be saved as a torrent file directly. Additionally, the `metadata` can be parsed into an object using the `parseMetaData` function.

### `sniffer.on('metadataError', function(errorInfo) { ... })`
Emitted when the service encounters an error during the metadata fetching process. The `errorInfo` parameter contains:
- `infoHash`: Buffer containing the infoHash
- `error`: Error object or string describing the error

### `sniffer.on('warning', function(warning) { ... })`
Emitted when the service encounters a non-critical warning. The `warning` parameter contains a warning message or object.

### `sniffer.on('error', function(error) { ... })`
Emitted when the service encounters a critical error. The `error` parameter contains an error object or string describing the error.


## Options

### address
The address to bind the DHTSniffer service. Default: '0.0.0.0'.

### port
The port number of the DHTSniffer service. Default: 6881.

### nodesMaxSize
The maximum number of nodes to keep in the DHT node table. Default: 1000.

### refreshPeriod
If the sniffer has not received any message from the DHT network during a time period, it will send the `find_node` message to other nodes. By default, refreshPeriod is set to 30 seconds (i.e., 30000 ms).

### announcePeriod
The period for announcing to the DHT network. Default: 5 minutes (i.e., 300000 ms).

### maximumParallelFetchingTorrent
Since every metadata request lasts for seconds, the service fetches metadata in parallel. This option is used to limit the number of parallel requests. Default: 16.

### maximumWaitingQueueSize
When there are more metadata requests than the maximum parallel limit, calls to the `sniffer.fetchMetaData` function will be put into a waiting queue. This option sets the size of the waiting queue. Default: -1 (no limit).

### downloadMaxTime
If the pending request exceeds this value, it will time out. Default: 30000 ms.

### ignoreFetched
Boolean value. If true, the service will ignore fetched requests that are still kept in the fetched cache. Default: true.

### aggressiveLevel
Default: `0`. Generally, the sniffer will only try to fetch one torrent with the same infoHash at a time. This helps improve efficiency by avoiding fetching duplicate torrents. However, if the sniffer only fetches one or two infoHashes, this feature can slow down the process of fetching a single infoHash. This option can be set to a value between `0` and `1` to increase the number of parallel fetches of the same infoHash.

### fetchedTupleSize
The size of the internal LRU cache that stores tuples like `{infoHash, peer}`. When the `ignoreFetched` option is set to `true` and the tuple is still in cache, metadata fetching requests will be ignored. Default: 1000.
