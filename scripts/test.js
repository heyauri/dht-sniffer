const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");
// const heapdump = require("heapdump");

const torrent_dir_path = "M:\\torrents"

// 端口检测和自动选择功能
async function findAvailablePort(startPort = 6881, maxAttempts = 100) {
    const net = require('net');
    const { exec } = require('child_process');
    const execAsync = require('util').promisify(exec);

    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;

        try {
            // 首先检查端口是否被占用
            if (process.platform === 'darwin' || process.platform === 'linux') {
                try {
                    const { stdout } = await execAsync(`lsof -ti:${port}`);
                    if (stdout.trim()) {
                        console.log(`Port ${port} is in use by process: ${stdout.trim()}`);
                        continue;
                    }
                } catch (e) {
                    // 端口没有被占用，继续检查
                }
            }

            // 然后尝试绑定端口
            const isAvailable = await new Promise((resolve) => {
                const server = net.createServer();

                server.listen(port, '0.0.0.0', () => {
                    const { port: listenedPort } = server.address();
                    server.close(() => {
                        resolve(listenedPort === port);
                    });
                });

                server.on('error', () => {
                    resolve(false);
                });
            });

            if (isAvailable) {
                console.log(`Port ${port} is available`);
                return port;
            }
        } catch (error) {
            console.log(`Port ${port} check failed: ${error.message}`);
            continue;
        }
    }

    throw new Error(`No available port found starting from ${startPort} after ${maxAttempts} attempts`);
}

// 获取DHT可用端口
async function getDHTAvailablePort(preferredPort = 6881) {
    try {
        console.log(`Checking preferred port: ${preferredPort}`);

        // 首先尝试首选端口
        const net = require('net');
        const { exec } = require('child_process');
        const execAsync = require('util').promisify(exec);

        // 检查端口占用情况
        if (process.platform === 'darwin' || process.platform === 'linux') {
            try {
                const { stdout } = await execAsync(`lsof -i:${preferredPort}`);
                console.log(`Port ${preferredPort} usage:\n${stdout}`);
            } catch (e) {
                console.log(`Port ${preferredPort} appears to be free`);
            }
        }

        const isAvailable = await new Promise((resolve) => {
            const server = net.createServer();

            server.listen(preferredPort, '0.0.0.0', () => {
                const { port: listenedPort } = server.address();
                server.close(() => {
                    console.log(`Successfully bound and released port ${listenedPort}`);
                    resolve(listenedPort === preferredPort);
                });
            });

            server.on('error', (error) => {
                console.log(`Failed to bind port ${preferredPort}: ${error.message}`);
                resolve(false);
            });
        });

        if (isAvailable) {
            console.log(`Preferred port ${preferredPort} is available`);
            return preferredPort;
        }

        console.log(`Preferred port ${preferredPort} is not available, trying alternatives...`);

        // 如果首选端口不可用，查找其他可用端口
        // DHT常用端口范围：6881-6889
        const dhtPorts = [6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889];

        for (const port of dhtPorts) {
            console.log(`Trying port ${port}...`);

            const portAvailable = await new Promise((resolve) => {
                const server = net.createServer();

                server.listen(port, '0.0.0.0', () => {
                    const { port: listenedPort } = server.address();
                    server.close(() => {
                        console.log(`Successfully bound and released port ${listenedPort}`);
                        resolve(listenedPort === port);
                    });
                });

                server.on('error', (error) => {
                    console.log(`Failed to bind port ${port}: ${error.message}`);
                    resolve(false);
                });
            });

            if (portAvailable) {
                console.log(`Found available port: ${port}`);
                return port;
            }
        }

        // 如果DHT端口都不可用，从6890开始查找
        console.log('DHT ports not available, searching from 6890...');
        return await findAvailablePort(6890);
    } catch (error) {
        console.error('Error in getDHTAvailablePort:', error);
        throw new Error(`Failed to find available DHT port: ${error.message}`);
    }
}

// 启动DHT嗅探器
async function startDHTSniffer() {
    try {
        // 获取可用端口
        const port = await getDHTAvailablePort(6881);
        console.log(`Using available port: ${port}`);

        let sniffer = new DHTSniffer(
            {
                port: port,
                nodesMaxSize: 10000,
                refreshPeriod: 30000,
                announcePeriod: 30000,
                maximumParallelFetchingTorrent: 40,
                maximumWaitingQueueSize: -1,
                downloadMaxTime: 20000,
                ignoreFetched: true,
                aggressiveLevel: 0
            });

        sniffer.start();
        sniffer.on("start", infos => {
            console.log(infos);
        })
        sniffer.on('infoHash', (peerInfo) => {
            let tors_path = torrent_dir_path;
            console.log('get infoHash:', peerInfo.infoHash, peerInfo.peer);
            if (!fs.existsSync(tors_path)) {
                fs.mkdirSync(tors_path);
            }
            if (!fs.existsSync(path.join(tors_path, `${peerInfo.infoHash.toString("hex")}.torrent`))) {
                sniffer.fetchMetaData(peerInfo, true);
                // console.log(JSON.stringify(sniffer.getStats()));
            }
        });
        sniffer.on('node', node => {
            console.log('find node', node["host"] + ":" + node["port"]);
        });
        sniffer.on('warning', err => {
            console.error('WARNING:', err);
        });
        sniffer.on('error', err => {
            console.error('ERROR:', err);
            console.error('ERROR STACK:', err.stack);
        });

        sniffer.on("metadata", (metadataInfo) => {
            console.log("success", metadataInfo.infoHash, metadataInfo.metadata);
            try {
                if (metadataInfo.metadata && Buffer.isBuffer(metadataInfo.metadata)) {
                    fs.writeFileSync(path.join(torrent_dir_path, `${metadataInfo.infoHash.toString("hex")}.torrent`), metadataInfo.metadata);
                    // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timpstamp + '.heapsnapshot'));
                } else {
                    console.warn(`Invalid metadata for infoHash ${metadataInfo.infoHash.toString("hex")}: metadata is ${metadataInfo.metadata === null ? 'null' : 'undefined'}`);
                }
            } catch (e) {
                console.error(e);
                // fs.writeFileSync(path.join(__dirname, `${metadataInfo.infoHash.toString("hex")}.torrent`), metadataInfo.metadata);
            }
        })
        sniffer.on("metadataError", data => {
            console.error("fail", data["infoHash"], data["error"]);
        })
        let userful_peers_path = path.join(__dirname, "../useful-peers.json");
        console.log(fs.existsSync(userful_peers_path))
        let usefulPeerDict = fs.existsSync(userful_peers_path) ? require(userful_peers_path) : {};
        console.log(usefulPeerDict)
        for (let peer of Object.values(usefulPeerDict)) {
            console.log("import peer", peer);
            sniffer.importPeer(peer);
        }

        setInterval(() => {
            console.log(JSON.stringify(sniffer.getStats()));
            let usefulPeers = sniffer.exportPeers();
            let currentTime = Date.now(); // 使用当前时间而不是固定的timestamp
            for (let peer of usefulPeers) {
                let peerKey = `${peer.host}:${peer.port}`;
                if (!Reflect.has(usefulPeerDict, peerKey)) {
                    usefulPeerDict[peerKey] = {
                        host: peer.host, port: peer.port, value: 1, lastSeen: currentTime
                    }
                } else {
                    // 只有当peer在当前周期中被再次发现时才增加value
                    if (usefulPeerDict[peerKey].lastSeen < currentTime - 50 * 1000) { // 50秒间隔避免重复计数
                        usefulPeerDict[peerKey]["value"] += 1;
                    }
                    usefulPeerDict[peerKey].lastSeen = currentTime;
                }
            }
            let now = Date.now();
            for (let key in usefulPeerDict) {
                let peer = usefulPeerDict[key];
                // 清理60天未活跃且value为1的peer
                if (peer.value == 1 && now - peer.lastSeen > 60 * 24 * 60 * 60 * 1000) {
                    Reflect.deleteProperty(usefulPeerDict, key);
                }
            }
            fs.writeFileSync(userful_peers_path, JSON.stringify(usefulPeerDict));
        }, 60 * 1000)

        setInterval(() => {
            // heapdump.writeSnapshot(path.join(__dirname, "../tmp/", timestamp + '.heapsnapshot'));
            // console.log(JSON.stringify(sniffer.getStats()));
        }, 60 * 1000)

        let tmp_fp = path.join(__dirname, "../tmp/arr")

        // 优雅退出处理函数
        function gracefulShutdown(signal) {
            console.log(`\nReceived ${signal}. Shutting down gracefully...`);

            try {
                let arr = sniffer.exportWaitingQueue();
                let json = JSON.stringify(arr);
                if (arr.length > 0) {
                    fs.writeFileSync(tmp_fp, json);
                    console.log(`Saved ${arr.length} items from waiting queue to ${tmp_fp}`);
                }

                // 停止DHT嗅探器
                if (sniffer && typeof sniffer.stop === 'function') {
                    sniffer.stop();
                    console.log('DHT sniffer stopped');
                }

                console.log('Graceful shutdown completed');
            } catch (error) {
                console.error('Error during graceful shutdown:', error);
            } finally {
                process.exit(0);
            }
        }

        // 监听SIGINT (Ctrl+C)和SIGTERM信号
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

        // 监听未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
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

        return sniffer;
    } catch (error) {
        console.error('Failed to start DHT sniffer:', error);
        process.exit(1);
    }
}

// 启动DHT嗅探器
startDHTSniffer().catch(console.error);
