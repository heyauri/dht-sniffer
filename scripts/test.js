const {DHTSniffer} = require("../lib/dht-sniffer");

let sniffer = new DHTSniffer({port:23456})

sniffer.on("infoHash",infoHash=>{
    console.log("get infoHash:",infoHash)
})
