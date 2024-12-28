"use strict";

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const METADATA_SUFFIX = ".metadata.json";

// A simple task queue implementation
function runQueue(tasks, concurrency, finalCallback) {
    let active = 0;
    let index = 0;
    let errors = [];

    function next() {
        if (index === tasks.length && active === 0) {
            // All tasks are done
            return finalCallback(errors.length > 0 ? errors : null);
        }
        if (active >= concurrency || index >= tasks.length) return;

        const task = tasks[index++];
        active++;
        task((err) => {
            if (err) errors.push(err);
            active--;
            next();
        });
    }

    // Start the initial batch of tasks
    for (let i = 0; i < concurrency; i++) {
        next();
    }
}

const download = module.exports = function download(src, fn) {
    // Process multiple downloads
    if (Array.isArray(src)) {
        const tasks = src.map((s) => (callback) => download(s, callback));
        return runQueue(tasks, 5, (errs) => {
            if (errs && errs.length > 0) errs.forEach((err) => console.log("[download] error: %s", err));
            fn();
        });
    }

    // Download a single resource
    fs.mkdir(path.dirname(src.file), { recursive: true }, function (err) {
        if (err) return fn(err);

        const metadataFile = `${src.file}${METADATA_SUFFIX}`;
        let etag = null;

        // Read ETag from metadata file
        fs.readFile(metadataFile, "utf8", (err, data) => {
            if (!err && data) {
                try {
                    const metadata = JSON.parse(data);
                    etag = metadata.etag || null;
                } catch (e) {
                    console.log("[download] Failed to parse metadata file: %s", metadataFile);
                }
            }

            const headers = {};
            if (etag) headers["If-None-Match"] = etag;

            fs.stat(src.file, function (err, stat) {
                if (!err) headers["If-Modified-Since"] = stat.mtime.toUTCString();
                return fetch(src.url, { headers: headers, redirect: 'follow', follow: 5 }).then(function (res) {
                    if (res.status === 304) return console.log("[download] '%s' not modified", src.url), fn(null);
                    if (res.status !== 200) return console.log("[download] '%s' status code %d", src.url, res.status), fn(null);

                    const et = res.headers.get("ETag");
                    const lm = res.headers.get("Last-Modified");

                    if (etag && et && etag === et) return console.log("[download] '%s' not modified", src.url), fn(null);
                    if (stat && lm && stat.mtime.valueOf() > new Date(lm).valueOf()) return console.log("[download] '%s' not modified", src.url), fn(null);

                    const fileStream = fs.createWriteStream(src.file);
                    res.body.pipe(fileStream).on("error", fn).on("finish", function () {
                        if (!et) return console.log("[download] '%s' complete", src.url), fn(null);

                        // Save ETag to metadata file
                        const newMetadata = JSON.stringify({ etag: et }, null, 2);
                        fs.writeFile(metadataFile, newMetadata, "utf8", (err) => {
                            if (err) console.log("[download] Failed to save metadata for '%s'", src.file);
                            console.log("[download] '%s' complete", src.url);
                            fn(null);
                        });
                    });
                }).catch(fn);
            });
        });
    });
};

