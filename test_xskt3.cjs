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
      let gName = $(tr).find('td[title^="Giải"]').text().trim().toLowerCase();
      if(!gName) {
         // handle cases like rowspan where G3 is on previous row, or handle it differently
      }
      // Actually we can just find 'td' with title="Giải ĐB", etc. Or td that contains the numbers.
      let labelTd = $(tr).find('td[title^="Giải"]');
      if (labelTd.length > 0) {
        let label = labelTd.attr('title').toLowerCase();
        // The numbers are in the next td (or em, p inside it)
        let numbersRaw = labelTd.next('td').text().trim();
        let numbers = numbersRaw.split(/\s+/).filter(Boolean);
        
        console.log(label, numbers);
      }
  });
}
scrapeXsktComVn();
