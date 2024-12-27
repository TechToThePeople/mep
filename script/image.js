const fetch = require('node-fetch');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve paths relative to the script file
const inputJsonPath = path.resolve(__dirname, '../data/meps.json');
const outputDir = path.resolve(__dirname, 'img/mep/');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Set optimal concurrency for sharp
sharp.concurrency(Math.max(1, os.cpus().length - 1)); // Use N-1 threads

async function downloadImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${imageUrl}: ${response.statusText}`);
        return await response.buffer();
    } catch (error) {
        console.error(`Error downloading ${imageUrl}:`, error.message);
        return null;
    }
}

async function processMEP(mep) {
    const { epid } = mep;
    const imageUrl = `https://www.europarl.europa.eu/mepphoto/${epid}.jpg`;
    const outputFile = path.join(outputDir, `${epid}.webp`);

    // Skip if file already exists
    if (fs.existsSync(outputFile)) {
        console.log(`Skipped: ${outputFile} (already exists)`);
        return;
    }

    try {
        // Download the image
        const imageBuffer = await downloadImage(imageUrl);
        if (!imageBuffer) return;

        // Resize with max height of 100px, maintaining aspect ratio, and cropping to focus on faces
        await sharp(imageBuffer)
            .resize({
                height: 100,
                fit: sharp.fit.cover,
                position: sharp.strategy.attention,
            })
            .toFormat('webp')
            .toFile(outputFile);

        console.log(`Processed: ${outputFile}`);
    } catch (error) {
        console.error(`Error processing ${imageUrl}:`, error.message);
    }
}

(async () => {
    try {
        // Read and parse JSON data
        const data = fs.readFileSync(inputJsonPath, 'utf8');
        const meps = JSON.parse(data);

        // Process all MEPs concurrently (limit concurrency to avoid system overload)
        const CONCURRENT_LIMIT = 5;
        const chunks = Array.from({ length: Math.ceil(meps.length / CONCURRENT_LIMIT) }, (_, i) =>
            meps.slice(i * CONCURRENT_LIMIT, i * CONCURRENT_LIMIT + CONCURRENT_LIMIT)
        );

        for (const chunk of chunks) {
            await Promise.all(chunk.map(processMEP));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
