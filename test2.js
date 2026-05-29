require('dotenv').config();
const { WarlockClient } = require('./dist/api/warlockClient');
const client = new WarlockClient();
client.getAllServices().then(res => console.log(JSON.stringify(res, null, 2))).catch(err => console.error(err));
