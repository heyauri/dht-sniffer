const { DHTSniffer } = require("../lib/dht-sniffer");

let sniffer = new DHTSniffer({ port: 23456, refreshTime: 3000 })
sniffer.start();
sniffer.on("infoHash", infoHash => {
    console.log("get infoHash:", infoHash)
})
sniffer.on("node", node => {
    console.log("find node", node)
})
sniffer.on("warning", err => {
    console.error(err);
})
sniffer.on("error", err => {
    console.error(err);
})
