const fs = require('fs');
async function run() {
  const res = await fetch("https://api.github.com/repos/BitsNBytes25/Warlock/contents/bruno-api/Warlock");
  const data = await res.json();
  for (const item of data) {
    if (item.download_url) {
      console.log("Fetching: " + item.download_url);
      const fileRes = await fetch(item.download_url);
      const text = await fileRes.text();
      console.log(`--- ${item.name} ---\n${text}\n\n`);
    }
  }
}
run();
