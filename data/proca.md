
q 'select epid, email, first_name, last_name, twitter, phone, gender, ENVI from meps.csv where ENVI <> ""' -d, -H -O | csvtojson > /var/www/proca/config/target/source/
