const axios = require('axios');
const cheerio = require('cheerio');

async function getKqxsUrls() {
  try {
    const { data } = await axios.get("https://kqxs.vn/mien-bac");
    const $ = cheerio.load(data);
    let urls = [];
    $("a").each((_, a) => {
        let h = $(a).attr("href");
        if(h && h.includes("mien-bac")) urls.push(h);
    });
    console.log(urls.slice(0, 30));
  } catch(e) { console.error(e); }
}
getKqxsUrls();
