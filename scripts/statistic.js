const { DHTSniffer } = require('../lib/dht-sniffer');
const fs = require("fs");
const path = require("path");

let sniffer = new DHTSniffer({ port: 6881, refreshTime: 30000, downloadMaxTime: 30000 });

let baseDir = path.join(__dirname, "../tors");

let fn_dict = {};
for (let f of fs.readdirSync(baseDir)) {
    let fp = path.join(baseDir, f);
    let buf = fs.readFileSync(fp);
    let metadata = sniffer.parseMetaData(buf);
    let fps = metadata.filePaths;
    // console.log(typeof fps);
    for (let fn of fps) {
        fn in fn_dict ? fn_dict[fn] += 1 : fn_dict[fn] = 1;
    }
}

console.log(fn_dict);
