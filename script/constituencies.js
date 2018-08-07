const fs = require('fs');
const http = require('http');
const got = require('got');
const {chain}  = require('stream-chain');

//const urlParse = require('url').parse;
//const csv = require('fast-csv');
//const zlib = require("zlib");

const url = "http://www.europarl.europa.eu/meps/en/json/getDistricts.html?country=";
const countries= ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "GR", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE", "GB"];

http.globalAgent.maxSockets = 8;

promises = [];
var total={};
region=streamCSV("data/regions.csv","country,region,meps");
mep=streamCSV("data/mep_regions.csv","country,region,mepid,name");
promises.push(new Promise((resolve, reject) => {region.on("close",() => resolve);}));
promises.push(new Promise((resolve, reject) => {mep.on("close",() => resolve);}));


countries.map((country)=>{
  let p = constituencies(country);
  p.then((meps)=>{meps.map((m)=>promises.push(m))})
  promises.push(p);
});
//promises.push(constituencies("FR"));

Promise
  .all(promises)
  .catch((err) =>{
    console.log(err);
  })
  .then(() => {
    console.log("done");
  });

function streamCSV(file,head){
//  return new Promise((resolve, reject) => {
    head = head.split(",");
    const csvwriter = require('csv-write-stream')({separator:",",headers: head,sendHeaders:true});

    function row (d) {
      console.log(d);
      return d;
    };

    const pipeline = chain([
//      row,
      csvwriter,
      fs.createWriteStream(file)
    ]);
    pipeline.on("close", () => resolve);
    return pipeline;
//  });
};


function constituencies(country){
  return new Promise((resolve, reject) => {
    let premises = [];
    got(url+country,{json:true})
      .then((d)=>{
        d.body.options.map((r)=>{
          if (!r.code) return;
          premises.push(meps(country,r.code));
        });
        resolve(premises);
      })
      .catch((err)=>{
        console.log(err);
        reject(err);
      });
  })
}

function meps(country,constituency){
  return new Promise((resolve, reject) => {
    got(url+country+"&countryCircons="+encodeURI(constituency),{json:true})
      .then((d)=>{
        d.body.result.map((m)=>{
          mep.write({country:country,region:constituency,mepid:m.persId,name:m.fullName});
        });
        region.write({country:country,region:constituency,meps:d.body.result.length});
        resolve();
      })
      .catch((err)=>{
        console.log(err);
        reject();
      });
  })
}
