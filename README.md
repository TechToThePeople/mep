# MEP

List of current MEPs filterable by country, committee, delegation, party...

It's a mix of various sources, the European Parliament Website, parltrack, euhubnews and some others.

And a bunch of manual data fixing, like adding the gender.

# download the result

all the votes:
https://mepwatch.eu/9/data/item_rollcall.csv

a specific vote:
https://mepwatch.eu/9/cards/167531.csv

more info about the meps:
https://mepwatch.eu/9/data/meps.csv


## How to update

* `gulp update` to fetch and update data
* `gulp build` to rebuild web resources (js and css)

## Helpers

For metadata updates and data inspection

* `node scripts/eugroup.js` — update `data/eugroup.json` from `data/eugroup.json` and download logos and icons to `img/group`
* `node scripts/update-comittees.js` — update `data/comittees.json` from eu website
* `node scripts/update-delegations.js` — update `data/delegations.json` from eu website
* `node scripts/constituencies.js` — extract constituencies data to `data/mep_regions.csv` and `data/regions.csv`
* `node script/csv2json.js data/meps.csv > meps.json` — convert `data/meps.csv` to json
