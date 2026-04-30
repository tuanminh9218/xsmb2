const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeKqxsVn(dateStr) {
  let url = "https://kqxs.vn/mien-bac";
  if (dateStr) {
    url = `https://kqxs.vn/mien-bac/ngay-${dateStr}.html`;
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    const kqxs = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };
    
    // figure out container
    const tbl = $(".table-result-lottery").first();
    console.log("caption:", tbl.find('caption').text().trim());
    
    tbl.find("tr").each((_, tr) => {
        const label = $(tr).find("td").first().text().trim().toLowerCase();
        let numbers = [];
        $(tr).find("td:not(:first-child)").each((_, vTd) => {
            let numStr = $(vTd).text().trim();
            // sometimes there are multiple spans
            $(vTd).find('span').each((_, span) => {
                let ns = $(span).text().trim();
                // there can be - or space inside
                numbers.push(...ns.split(/[-,\s]+/).filter(Boolean));
            });
            if ($(vTd).find('span').length === 0 && numStr) {
                 numbers.push(...numStr.split(/[-,\s]+/).filter(Boolean));
            }
        });
        
        // Let's print out what we get
        console.log("label:", label, numbers);
    });
    
  } catch(e) { console.error(e); }
}

scrapeKqxsVn('29-04-2026');
