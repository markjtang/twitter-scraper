// run.js
const TwitterScraperMVP = require('./TwitterScraperMVP');

const config = {
    checkInterval: 10 * 60 * 1000, // 10 minutes
    influencers: [
        'zachxbt',
        // Add more influencers
    ]
};

const scraper = new TwitterScraperMVP(config);

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await scraper.cleanup();
    process.exit(0);
});

// Start scraping
scraper.start().catch(console.error);