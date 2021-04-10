const csvparse=require('csv-parse/lib/sync.js');
const fs = require('fs');

var list = process.argv.slice(2);

const raw = csvparse(fs.readFileSync(list[0]),{columns:true,auto_parse:true}); 
let data = [];

const pick = (obj, keys) => Object.fromEntries(
  keys.map(key => [key, obj[key]])
);

const props ="epid,country,first_name,last_name,twitter".split(",");
//raw.map( d => data.push(pick(d, props)));

const epick = d => ({
  epid:d.epid,
  first_name:d.first_name,
  eugroup:d.eugroup,
  last_name:d.last_name,
  Twitter:d.twitter,
  constituency:{party:d.party,country:d.country}
  });

raw.map( d => data.push(epick(d)));
console.log(JSON.stringify(data));
