const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const urls = [
        {name: 'hytale', url: 'https://hytale-docs.com/docs/api/overview'},
        {name: 'vein', url: 'https://ramjet.notion.site/HTTP-API-279f9ec29f178064b0b5fd45bcba4e7b'},
        {name: 'valheim', url: 'https://valheim.fandom.com/wiki/Developer_console'}
    ];

    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    
    for (const u of urls) {
        console.log(`Scraping ${u.name}...`);
        try {
            await page.goto(u.url, {waitUntil: 'networkidle2'});
            const text = await page.evaluate(() => document.body.innerText);
            fs.writeFileSync(`${u.name}_text.txt`, text);
            console.log(`Saved ${u.name}_text.txt`);
        } catch (e) {
            console.error(`Error scraping ${u.name}: ${e.message}`);
        }
    }
    
    await browser.close();
})();
