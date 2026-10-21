"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { parse_mepid } = require("./update-meps.js");

const parse = function(data) {
	return new Promise(function(resolve, reject) {
		parse_mepid(data, function(err, res) {
			if (err) return reject(err);
			resolve(res);
		});
	});
};

const record = {
	fullName: "Jane DOE",
	countryLabel: "Belgium",
	politicalGroupLabel: "Group X",
	persId: "123",
	nationalPoliticalGroupLabel: "Partij Y",
};

const record_xml = '<?xml version="1.0" encoding="UTF-8"?>' +
	'<meps><mep><fullName>Jane DOE</fullName>' +
	'<country>Belgium</country>' +
	'<politicalGroup>Group X</politicalGroup>' +
	'<id>123</id>' +
	'<nationalPoliticalGroup>Partij Y</nationalPoliticalGroup>' +
	'</mep></meps>';

test("parses the JSON full-list into the shape xml2js produced", async function() {
	const from_json = await parse(JSON.stringify({ list: [record] }));
	const from_xml = await parse(record_xml);

	// only the fields update-meps.js consumes matter
	const pick = function(r) {
		return r.meps.mep.map(function(m) {
			return { id: m.id, fullName: m.fullName, country: m.country, politicalGroup: m.politicalGroup };
		});
	};

	assert.deepStrictEqual(pick(from_json), pick(from_xml));
	assert.deepStrictEqual(pick(from_json), [{
		id: ["123"],
		fullName: ["Jane DOE"],
		country: ["Belgium"],
		politicalGroup: ["Group X"],
	}]);
});

test("tolerates leading whitespace before the JSON body", async function() {
	const parsed = await parse("\n\t" + JSON.stringify({ list: [record] }));
	assert.strictEqual(parsed.meps.mep.length, 1);
});

test("parses an empty list", async function() {
	const parsed = await parse(JSON.stringify({ list: [] }));
	assert.deepStrictEqual(parsed.meps.mep, []);
});

test("reports malformed JSON as an error", async function() {
	await assert.rejects(parse("{ not json"), SyntaxError);
});
