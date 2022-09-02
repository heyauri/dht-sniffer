import * as crypto from 'crypto';
import { DHT } from './dht';
import * as metadataHelper from './metadata-helper';

import { EventEmitter } from 'events';
import * as utils from './utils';
import * as LRU from "lru-cache";

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    latestReceive: Date;
    refreshIntervalId: any;
    rpc: any;
    status: boolean;
    metadataWaitingQueues: Array<any>;
    metadataFetchingDict: any;
    fetchdCache: any;
    findNodeCache: any;
    uselessPeers:any;
    constructor(options) {
        super();
        this._options = Object.assign(
            {
                port: 6881,
                refreshTime: 1 * 60 * 1000,
                maximumParallelFetchingTorrent: 25,
                maximumWaitingQueueSize: -1,
                downloadMaxTime: 30000,
                aggressive: false,
                ignoreFetched: false,
                concurrency: 16,
                fetchdCacheSize:40000,
                findNodeCacheSize:40000
            },
            options
        );
        this.status = false;
        this.metadataWaitingQueues = [];
        this.metadataFetchingDict = {};
        this.fetchdCache = new LRU({ max: this._options.fetchdCacheSize, ttl: 60 * 60 * 1000 });
        this.findNodeCache = new LRU({ max: this._options.findNodeCacheSize, ttl: 60 * 60 * 1000, updateAgeOnHas: true });
        this.uselessPeers = new LRU({ max: 1000, ttl: 60 * 60 * 1000 });
    }

    start() {
        const _this = this;
        if (this.status) {
            console.log('The sniffer is already working');
            return;
        }
        this.dht = new DHT({
            concurrency: this._options.concurrency || 16
        });
        this.rpc = this.dht._rpc;
        this.latestReceive = new Date();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
        });
        this.dht.on('warning', err => _this.emit('warning', err));
        this.dht.on('error', err => _this.emit('error', err));
        /**
         *  emit data like {infoHash, peer: { address: '123.123.123.123', family: 'IPv4', port: 6882, size: 104 }}
         */
        this.dht.on('get_peers', data => {
            _this.emit('infoHash', data["infoHash"], data["peer"]);
        });

        this.dht.on('node', function (node) {
            _this.latestReceive = new Date();
            _this.emit('node', node);
            let nodeKey = JSON.stringify([node["host"], node["port"]]);
            if (!_this.findNodeCache.has(nodeKey) && Math.random() > Math.log10(_this.rpc.pending.length)) {
                _this.findNode(node, node.id);
                _this.findNodeCache.set(nodeKey, 1);
            }
        });
        /**
         *  If no request is received within a configured time period, lookup some new nodes
         */
        this.refreshIntervalId = setInterval(() => {
            let nodes = this.dht.toJSON().nodes;
            if (_this._options["aggressive"] || new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                nodes.map(node => {
                    if (Math.random() > Math.log10(_this.rpc.pending.length)) {
                        // console.log('try find nodes', node);
                        _this.findNode(node, _this.rpc.id);
                    }
                });

            }
            if (nodes.length === 0) {
                _this.dht._bootstrap(true);
            }
            if (_this.rpc.pending.length > 1000) {
                _this.reduceRPCPendingArray();
            }
            console.log('nodes:', nodes.length);
        }, this._options.refreshTime);
        this.status = true;
    }
    stop() {
        const _this = this;
        this.dht.destory(() => {
            clearInterval(_this.refreshIntervalId);
            _this.status = false;
        });
    }

    findNode(peer, nid) {
        const _this = this;
        let id = nid !== undefined ? utils.getNeighborId(nid, this.dht.nodeId) : this.dht.nodeId;
        let message = {
            t: crypto.randomBytes(4),
            y: 'q',
            q: 'find_node',
            a: {
                id,
                target: crypto.randomBytes(20)
            }
        };
        this.dht._rpc.query(peer, message, (err, reply) => {
            try {
                if (peer && peer.id && _this.rpc.nodes.get(peer.id) && utils.isNodeId(peer.id, 20)) {
                    if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
                        _this.rpc.remove(peer.id)
                    }
                }
            } catch (e) {
                // do nothing
            }
            if (reply && reply.r && reply.r.nodes) {
                let nodes = utils.parseNodes(reply.r.nodes, 20);
                for (let node of nodes) {
                    if (utils.isNodeId(node.id, 20)) {
                        // _this.rpc.nodes.add(node);
                        _this.dht.addNode(node);
                    }
                }
            }
            // console.log("make neighboor query", err, reply);
        });
    }
    /**
     * @param infoHash
     * @param targetNode the origin node that is looking for the target infoHash, generally offered by the intergrated
     * dht module. If it is ignored, the sniffer will try to look up some peer.
     */
    fetchMetaData(infoHash: Buffer, peer: any) {
        this.metadataWaitingQueues.unshift({ infoHash, peer });
        if (this._options.maximumWaitingQueueSize > 0 && this.metadataWaitingQueues.length > this._options.maximumWaitingQueueSize) {
            this.metadataWaitingQueues.pop();
        }
        this.dispatchMetadata();
        // _this.dht.lookup(infoHash);
    }
    dispatchMetadata() {
        let _this = this;
        let fetchings = Object.keys(this.metadataFetchingDict);
        if (fetchings.length > this._options.maximumParallelFetchingTorrent) {
            return;
        }
        let nextFetching = this.metadataWaitingQueues.pop();
        if (!nextFetching) return;
        let {
            infoHash,
            peer
        } = nextFetching;
        let nextFetchingKey = this.getNextFetchingKey(nextFetching);
        // console.log(nextFetchingKey);
        if (this._options["ignoreFetched"] && this.fetchdCache.get(nextFetchingKey)) {
            return;
        }
        this.metadataFetchingDict[nextFetchingKey] = 1;
        this.fetchdCache.set(nextFetchingKey, 1);
        metadataHelper
            .fetch({
                infoHash,
                peer
            },
                this._options
            )
            .then(metadata => {
                if (metadata === undefined) return;
                _this.emit('metadata',
                    infoHash,
                    metadata
                );
            }).catch(error => {
                let peerKey = `${peer.address}+${peer.port}`;
                _this.uselessPeers.set(peerKey, 1);
                _this.emit('metadataError', {
                    infoHash,
                    error
                });
            }).finally(() => {
                _this.dispatchMetadata();
                Reflect.deleteProperty(_this.metadataFetchingDict, nextFetchingKey);
            });
    }
    parseMetaData = metadataHelper.parseMetaData
    getSizes() {
        let fetchings = Object.keys(this.metadataFetchingDict);
        console.log(fetchings.length, this.metadataWaitingQueues.length, this.fetchdCache.keyMap.size,
            this.dht._tables.size, this.dht._values.size,
            this.dht._peers.size, this.rpc.pending.length);
    }
    reduceRPCPendingArray() {
        let pending = this.rpc.pending.slice(0, 1000);
        this.rpc.pending = pending;
    }
    getNextFetchingKey(nextFetching) {
        let {
            infoHash,
            peer
        } = nextFetching;
        return JSON.stringify([peer["address"], peer["port"], infoHash.toString("hex")]);
    }
}

export { DHTSniffer };
