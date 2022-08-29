//q "select v.result, m.* from data/vote/89202.csv v left join data/meps-aliases.csv a on v.name=a.alias join data/meps.all.csv m on m.epid=a.epid and m.start <= '2018-03-14' and (m.end >='2018-03-14' or m.end='')" -d, -H -O > data/vote/89202.full.csv

//find non matching aliases
//q "select v.* from data/vote/89202.csv v left join data/meps-aliases.csv a on v.name=a.alias where a.epid is null" -d, -H -O

// example https://www.europarl.europa.eu/doceo/document/PV-9-2022-07-04-RCV_FR.xml

'use strict';
var fs = require('fs');
var path = require('path');
var csvWriter = require('csv-write-stream');
var parser = require('xml2json');
var argv = require('minimist')(process.argv.slice(2),{alias:{o:"out"}});
const xmlfile = argv._[0];
const vid = argv.id;
var out=process.stdout;
if (!xmlfile) {
  console.log("usage: vote.js XMLVOTE.xml --id vote_id --out");
  process.exit(1);
}

var writerOverview = csvWriter({ headers: ["id","name","date","for","against","abstention"]});
var writerRoll = csvWriter({ headers: ["vote_id","mep_id","eugroup","result","name"]});

if (argv.out) {
  if (argv.out === true) {
    out= vid ? "data/vote/"+vid+".csv" : "data/vote/"+path.basename(xmlfile).replace(".xml", ".csv");
  } else {
    out= argv.out;
  }
  console.log ("writing file "+ out);
  out=fs.createWriteStream(out);
};
if (vid) {
  writerRoll.pipe(out);
} else {
  writerOverview.pipe(out);
}

fs.readFile( xmlfile, function(err, data) {
  var csv=[];
  var json = parser.toJson(data,{object:true});
  json["PV.RollCallVoteResults"]["RollCallVote.Result"].forEach(function(roll){

    var total= function(type){ //type=For,Against,Abstension
      var r=roll['Result.'+type];
      if (!r) return null;
      return r.Number;
    }

    var list = function(type){ //type=For,Against,Abstension
      //const convertType={"For":1,"Against":-1,"Abstention":0};
      const convertType={"For":"for","Against":"against","Abstention":"abstention"};
      var r=roll['Result.'+type]['Result.PoliticalGroup.List'];
      r.forEach(function(group){
        var g=group["PoliticalGroup.Member.Name"];
        if (!Array.isArray(g)) g=[g];//if only one mep
        g.forEach(function(mep){
          var n = mep.$t.replace("ß","ss"); //For some reason, the alias is using ss instead"
          writerRoll.write({vote_id:v.id,mep_id:mep.MepId,eugroup:group.Identifier,result:convertType[type],name:n.toLowerCase()});
        });
      });
    };

    var v={id:roll.Identifier,name:roll['RollCallVote.Description.Text'],date:roll.Date,for:total('For'),against:total('Against'),abstention:total('Abstention')};
    if (vid) { // we are processing a specific vote only
      if (vid != v.id) return;
      list('For');
      list('Against');
      list('Abstention');
    } else {
      writerOverview.write(v);
    }

  });
  writerOverview.end();
  writerRoll.end();
});
