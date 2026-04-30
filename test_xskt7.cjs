const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn() {
  const { data } = await axios.get("https://xskt.com.vn/xsmb/ngay-29-4-2026");
  const $ = cheerio.load(data);
  const container = $("#MB0");
  const time = container.find(".dockq").attr("title") || container.find("th").first().text().trim();
  console.log(time);
}
scrapeXsktComVn();
