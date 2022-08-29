const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");

let sniffer = new DHTSniffer({ port: 6881, refreshTime: 30000,downloadMaxTime:30000 });

let buf = fs.readFileSync(path.join(__dirname,"../tors/a8251db38e3781893bdc48a47117c51a3b57f656.torrent"));

let md = sniffer.parseMetaData(buf);

console.log(md);
console.log(md.infoHash.toString("hex"));
