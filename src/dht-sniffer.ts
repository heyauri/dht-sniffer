import * as crypto from 'crypto';
import { DHT } from './dht';
import * as metadataHelper from './metadata-helper';

import { EventEmitter } from 'events';
import * as utils from './utils';

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    latestReceive: Date;
    refreshIntervalId: any;
    rpc: any;
    status: boolean;
    metadataWaitingQueues: Array<any>;
    metadataFetchingDict: any;

    constructor(options) {
        super();
        this._options = Object.assign(
            {
                port: 6881,
                refreshTime: 1 * 60 * 1000,
                maximumParallelFetchingTorrent: 10,
                downloadMaxTime: 30000
            },
            options
        );
        this.status = false;
        this.metadataWaitingQueues = [];
        this.metadataFetchingDict = {};
    }

    start() {
        const _this = this;
        if (this.status) {
            console.log('The sniffer is already working');
            return;
        }
        this.dht = new DHT();
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
            _this.findNode(node, node.id);
        });
        /**
         *  If no request is received within a configured time period, lookup some new nodes
         */
        this.refreshIntervalId = setInterval(() => {
            const nodes = this.dht.toJSON().nodes;
            if (new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                if (nodes.length === 0) {
                    _this.dht._rpc.bootstrap.forEach(node => _this.findNode(node, _this.rpc.id));
                } else {
                    nodes.map(node => {
                        if (Math.random() > 0.5) {
                            // console.log('try find nodes', node);
                            _this.findNode(node, _this.rpc.id);
                        }
                    });
                }
            }
            if (nodes === 0) {
                _this.dht.bootstrap();
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
        const _this = this;
        _this.metadataWaitingQueues.push(infoHash);
        // _this.dht.lookup(infoHash);
        metadataHelper
            .fetch(
                {
                    infoHash,
                    peer
                },
                this._options
            )
            .then(metadata => {
                _this.emit('metadata',
                    infoHash,
                    metadata
                );
            }).catch(error => {
                _this.emit('metadataError', {
                    infoHash,
                    error
                });
            });
    }
    parseMetaData = metadataHelper.parseMetaData
}

export { DHTSniffer };
