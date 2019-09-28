/*

q 'select inc.id as id_incoming, out.id as id_outgoing, cast(julianday(inc.start)-julianday(out.end) as int) as days, out.country,out.eugroup,out.end,inc.start,out.fullName as name_out,inc.fullName as name_in from data/inout.csv out join data/inout.csv inc on out.file="outgoing" and inc.file="incoming" and inc.country=out.country and inc.eugroup=out.eugroup and date(out.end) <= date(inc.start) and date(out.end,"+50 days") >= date(inc.start) order by out.country,out.eugroup' -d, -H   -O > data/replacement.csv

q 'select name_out, count(*) from data/replacement.csv group by name_out having count(*) >1' -d, -H 

 */

"use strict";
function main (){
const fs = require('fs'),
  xml2js = require('xml2js'),
  writer = require('csv-write-stream')();

var fixDate=function (d){
  return d ? d.substring(6,10) +"-"+d.substring(3,5)+"-"+d.substring(0,2) : null;
};
var parse = function(file){
  var parser = new xml2js.Parser({explicitArray:false,mergeAttrs:true
  ,tagNameProcessors: [function(k){return k.startsWith('mandate-')?k.substring(8):k}]
  ,valueProcessors:[
    function(v,k){return k == "id" || k == "leg"? +v:v},
    function(v,k){return k == 'end' && (v== 'ONGOING' || v == '01/07/2019')? null:v},
    function(v,k){return k == 'start' || k=='end' ? fixDate(v):v},
  ]
  });
	return new Promise(function (resolve, reject) {
    fs.readFile("./data/" + file +".xml", 'utf8', function(err, data) {
			if (err) 
				reject(err);
      parser.parseString(data, function (err, result) {
        if (err) 
          reject(err);
        result.meps.mep.forEach(function(d){
           d.file = file;
           d.country=d.country.countryCode;
          d.eugroup=d.politicalGroup.bodyCode;
          d.party=d.nationalPoliticalGroup._;
          delete d.politicalGroup;
          delete d.nationalPoliticalGroup;
        });
        //console.log(result.meps.mep[0]);
        resolve(result.meps.mep);
      });
    });
  });
};

Promise.all([parse("incoming"),parse("outgoing")])
  .then(d =>{ 
    var mepid={};
    console.log("incoming " +d[0].length +" outgoing "+d[1].length);

     writer.pipe(fs.createWriteStream('data/inout.csv'));
     d[0].forEach( (mep) => {
       mepid[mep.id]=mep;
       writer.write(mep);
     });
     d[1].forEach(mep => writer.write(mep));
     fs.writeFileSync('data/inout.json', JSON.stringify(mepid));
     writer.end();

  })
};

if (require.main === module) {
  main();
} else {
  module.exports = function(cb) {
    main();
    cb()
  };
}

//parse("incoming.xml").then(data=>console.log(data[0]));
//parse("outgoing.xml").then(data=>console.log(data[0]));
