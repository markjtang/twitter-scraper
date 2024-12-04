const { chromium } = require('playwright');
const fs = require('fs/promises');
const path = require('path');

class TwitterScraperMVP {
    constructor(config = {}) {
        this.config = {
            dataPath: path.join(__dirname, 'twitter_data.json'),
            checkInterval: 10 * 60 * 1000, // 10 minutes
            influencers: [
                'zachxbt',
                'solanafloor',
                'punk6529'
                // Add more influencers here
            ],
            ...config
        };

        this.browser = null;
        this.context = null;
    }

    async initialize() {
        try {
            // Launch browser
            this.browser = await chromium.launch({ headless: true });
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            console.log('Browser initialized');
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    async scrapeUser(username) {
        console.log(`Scraping tweets for ${username}`);
        const page = await this.context.newPage();

        try {
            // Navigate to user's profile
            await page.goto(`https://twitter.com/${username}`, {
                waitUntil: 'domcontentloaded'
            });

            // Wait for tweets to load
            await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

            // Scroll a few times to load more tweets
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await page.waitForTimeout(1000);
            }

            // Extract tweets
            const tweets = await page.evaluate(() => {
                const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');

                debugger
                return Array.from(tweetElements).map(tweet => {
                    // Get tweet text
                    const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.innerText || '';

                    // Get timestamp
                    const timeElement = tweet.querySelector('time');
                    const timestamp = timeElement?.getAttribute('datetime') || '';

                    // Get engagement metrics
                    const likes = tweet.querySelector('[data-testid="like"]')?.innerText || '0';
                    const retweets = tweet.querySelector('[data-testid="retweet"]')?.innerText || '0';

                    return {
                        text: tweetText,
                        timestamp,
                        metrics: {
                            likes,
                            retweets
                        }
                    };
                });
            });

            // Add username and scrape time to tweets
            const scrapedTime = new Date().toISOString();
            return tweets.map(tweet => ({
                ...tweet,
                username,
                scrapedAt: scrapedTime
            }));

        } catch (error) {
            console.error(`Error scraping ${username}:`, error);
            return [];
        } finally {
            await page.close();
        }
    }

    async saveTweets(tweets) {
        try {
            // Load existing data
            let existingData = [];
            try {
                const fileData = await fs.readFile(this.config.dataPath, 'utf8');
                existingData = JSON.parse(fileData);
            } catch (error) {
                // File doesn't exist or is invalid, start fresh
                existingData = [];
            }

            // Add new tweets
            const updatedData = [...tweets, ...existingData];

            // Keep only last 100 tweets per user to manage file size
            const uniqueUsernames = [...new Set(updatedData.map(t => t.username))];
            const filteredData = uniqueUsernames.flatMap(username => {
                const userTweets = updatedData.filter(t => t.username === username);
                return userTweets.slice(0, 100);
            });

            // Save to file
            await fs.writeFile(this.config.dataPath, JSON.stringify(filteredData, null, 2));
            console.log(`Saved ${tweets.length} new tweets`);
        } catch (error) {
            console.error('Error saving tweets:', error);
        }
    }

    async start() {
        try {
            await this.initialize();

            while (true) {
                console.log('Starting scrape cycle...');

                for (const username of this.config.influencers) {
                    try {
                        const tweets = await this.scrapeUser(username);
                        if (tweets.length > 0) {
                            await this.saveTweets(tweets);
                        }
                        // Wait between users to avoid detection
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } catch (error) {
                        console.error(`Error processing ${username}:`, error);
                        continue;
                    }
                }

                // Wait for next cycle
                console.log(`Waiting ${this.config.checkInterval/1000} seconds until next cycle...`);
                await new Promise(resolve => setTimeout(resolve, this.config.checkInterval));
            }
        } catch (error) {
            console.error('Fatal error:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = TwitterScraperMVP;