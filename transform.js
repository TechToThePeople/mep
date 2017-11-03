'use strict';

const fs = require('fs');
const path = require('path');
const s=require("stream");
const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

function f(assembler){
  // test only top-level objects in the array: 
  if(assembler.stack.length == 2 && assembler.key === null){
    // make a decision depending on a boolean property "active": 
    if(assembler.current.hasOwnProperty("active")){
      // "true" to accept, "false" to reject 
      return assembler.current.active;
    }
  }
  // return undefined to indicate our uncertainty at this moment 
}
 
var stream = StreamFilteredArray.make({objectFilter: f});
var transform = s.Transform;

// Example of use: 
 
function clean (d) {
  function activeOnly(attr) {
    var r=[];
    d[attr].forEach(function(item){
      if (item.end !== '9999-12-31T00:00:00') return;
      delete item.end;
      item.start = item.start.replace("T00:00:00","");
      if (item.abbr == null){
        delete item.abbr;
      } else {
	delete item.Organization;
      }
      if (item.committee_id) delete item.committee_id;
      r.push(item);
    });
    d[attr] = r;
  }
  delete d.changes;
  delete d.Name.aliases;
  activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
  activeOnly("Staff");
  return d;
}

stream.output.on("data", function(data){
  console.log(clean(data.value));
  writer
process.exit();
});

stream.output.on("end", function(){
  console.log("done");
});
 
let fname = path.join(__dirname, 'data/ep_meps_current.json');
fs.createReadStream(fname).pipe(stream.input);
var writer = fs.createWriteStream(path.join(__dirname,'data/meps.json')); 

