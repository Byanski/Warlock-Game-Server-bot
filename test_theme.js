const { WarlockClient } = require('./dist/api/warlockClient.js');
const cheerio = require('cheerio');

(async () => {
  const client = new WarlockClient();
  await client.authenticate();
  
  const res = await client.fetchWithCookies(client.baseUrl + '/dashboard', {method: 'GET'});
  const html = await res.text();
  
  const $ = cheerio.load(html);
  console.log('HTML classes:', $('html').attr('class'));
  console.log('HTML data-theme:', $('html').attr('data-theme'));
  console.log('Body classes:', $('body').attr('class'));
  console.log('Body data-theme:', $('body').attr('data-theme'));
  
  const themes = [];
  $('link[rel="stylesheet"]').each((i, el) => {
    themes.push($(el).attr('href'));
  });
  console.log('CSS links:', themes);
})().catch(console.error);
