const csvparse=require('csv-parse/lib/sync.js');
const fs = require('fs');

var list = process.argv.slice(2);

const raw = csvparse(fs.readFileSync(list[0]),{columns:true,auto_parse:true}); 
let data = [];

const pick = (obj, keys) => Object.fromEntries(
  keys.map(key => [key, obj[key]])
);


const props ="epid,country,first_name,last_name,twitter".split(",");

raw.map( d => data.push(pick(d, props)));

console.log(data);
