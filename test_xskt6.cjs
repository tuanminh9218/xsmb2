const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn() {
  const { data } = await axios.get("https://xskt.com.vn/xsmb");
  const $ = cheerio.load(data);
  const container = $("#MB0");
  console.log("table html:", container.html().slice(0, 500));
}
scrapeXsktComVn();
