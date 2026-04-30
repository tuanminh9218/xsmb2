const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn() {
  const { data } = await axios.get("https://xskt.com.vn/xsmb");
  const $ = cheerio.load(data);
  const container = $("#MB0");
  console.log("has MB0:", container.length);
  console.log("time:", container.find("h2").text().trim() || container.closest('.box').find('.title-phu a').first().text().trim());
}
scrapeXsktComVn();
