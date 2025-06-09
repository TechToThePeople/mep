#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const { parseString } = require('xml2js');

const jsonFilePath = "./data/meps.json";
const mepsJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

async function updateMEPsWithLang(url, langCode = 'XX') {
  let processed = 0;
  try {
    const xmlData = await fetchXml(url);
    const mepsXml = await parseXml(xmlData);

  mepsJson.forEach(mepJson => {
      if (mepsXml.has(mepJson.epid)) {
        mepJson.constituency.lang = langCode;
        processed ++;
      }
    });


  } catch (error) {
    console.error('Error:', error.message);
    return 0;
  }
  return processed;
}

// Helper function to fetch XML
function fetchXml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Helper function to parse XML
function parseXml(xmlData) {
  return new Promise((resolve, reject) => {
    parseString(xmlData, (err, result) => {
      if (err) return reject(err);
      
      const idSet = new Set();
      
      if (!result?.meps?.mep) {
        return resolve(idSet);
      }
      
      result.meps.mep.forEach(mep => {
        if (mep.id?.[0]) {
          idSet.add(+mep.id[0]);
        }
      });
      
      resolve(idSet);
    });
  });
}

const main = module.exports = async function main(fn) {
  let processed = 0;
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

 processed += await updateMEPsWithLang('https://www.europarl.europa.eu/meps/en/download/advanced/xml?name=&euPoliticalGroupBodyRefNum=&countryCode=BE&constituency=Coll%C3%A8ge+%C3%A9lectoral+fran%C3%A7ais&bodyType=ALL', 'fr');
 processed += await updateMEPsWithLang('https://www.europarl.europa.eu/meps/en/download/advanced/xml?name=&euPoliticalGroupBodyRefNum=&countryCode=BE&constituency=Nederlands+kiescollege&bodyType=ALL', 'nl');

 processed += await updateMEPsWithLang('https://www.europarl.europa.eu/meps/en/download/advanced/xml?name=&euPoliticalGroupBodyRefNum=&countryCode=BE&constituency=Coll%C3%A8ge+%C3%A9lectoral+germanophone&bodyType=ALL', 'fr'); //German -> French

    fs.writeFileSync(jsonFilePath, JSON.stringify(mepsJson));
    console.log(`Successfully updated ${jsonFilePath}`);
		fn(null, processed);

};

if (require.main === module) main();

