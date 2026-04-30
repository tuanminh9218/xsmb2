const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn(dateStr) {
  let url = "https://xskt.com.vn/xsmb/ngay-29-4-2026";
  const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    
  console.log(data.match(/<table.*?<\/table>/s)?.[0]?.slice(0, 1000) || 'no table found');
}

scrapeXsktComVn();
