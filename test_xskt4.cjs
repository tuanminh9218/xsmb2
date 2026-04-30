const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn() {
  const { data } = await axios.get("https://xskt.com.vn/xsmb/ngay-29-4-2026");
  const $ = cheerio.load(data);
  const container = $("#MB0");
  
  const kqxs = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };
  
  container.find("tr").each((_, tr) => {
      let labelTd = $(tr).find('td[title^="Giải"]');
      if (labelTd.length > 0) {
        let label = labelTd.attr('title').toLowerCase();
        
        let valTd = labelTd.next('td');
        // replace <br> with space
        valTd.find('br').replaceWith(' ');
        
        let numbersRaw = valTd.text().trim();
        let numbers = numbersRaw.split(/\s+/).filter(Boolean);
        
        console.log(label, numbers);
      }
  });
}
scrapeXsktComVn();
