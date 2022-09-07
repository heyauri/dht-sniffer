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

// console.log(fn_dict);
let st_arr = Object.keys(fn_dict).map(item=>{
    return [item,fn_dict[item]];
}).sort((a,b)=>{
    return b[1] - a[1];
})

console.log(st_arr);
