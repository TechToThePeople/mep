const fetch = require ('node-fetch');
const fs = require('fs');
const imgUrl = "https://s3.eu-central-1.amazonaws.com/newshubv2/party/";
let groups = JSON.parse(fs.readFileSync('data/eugroup.json'));

 const downloadFile = (async (url, path) => {
   console.log(url,path);
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", (err) => {
        reject(err);
      });
      fileStream.on("finish", function() {
        console.log("saved");
        resolve();
      });
    });
});

async function downloadGroup (groups)  {
  const r={};
  groups.items.map (async g => {
    //const d = (({accronym,name,picture,url}) => ({eParty,fullName,pictureLink,profileLink}))(g);
    const d = {
      accronym:g.eParty,
      name:g.fullName,
      picture:decodeURIComponent(g.pictureLink.replace(imgUrl,"")),
      url:g.profileLink
    }
    r[d.accronym] = d;
    await downloadFile("https://www.google.com/s2/favicons?domain="+d.url,'./img/party/icon/'+d.picture);
    console.log(imgUrl+d.picture);
    await downloadFile(imgUrl+d.picture,'./img/party/logo/'+d.picture);
  });
  fs.writeFileSync('./data/eugroups.json', JSON.stringify(r,null,2));

};

downloadGroup(groups);


/*    fullName: 'Renew Europe',
    party: null,
    localParty: null,
    pictureLink:
     'https://s3.eu-central-1.amazonaws.com/newshubv2/party/Renew.png',
    profileLink: 'https://reneweuropegroup.eu',
    country: '11',
    type: 'grouppress',
    eParty: 'Renew',
*/

const convert= {
ECR:'ECR',
'Group of the European United Left - Nordic Green Left':'GGG',
ID:'ID',
NA:'NA',
PPE:'EPP',
RE:'RE',
'S&D':'S&D',
'Verts/ALE':'aaa'
};

