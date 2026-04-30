const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXosoComVn(dateStr) {
  let url = "https://xoso.com.vn/xo-so-mien-bac/xsmb-p1.html";
  if (dateStr) {
    url = `https://xoso.com.vn/xsmb-${dateStr}.html`;
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

    const container = $(".box-ketqua").first().length ? $(".box-ketqua").first() : $(".box-kq-mien-bac").first();

    container.find("table tr").each((_, tr) => {
      // Look for th, then td
      let label = $(tr).find("th").first().text().trim().toLowerCase();
      if (!label) label = $(tr).find("td").first().text().trim().toLowerCase();
      
      const numbers = $(tr).find("td").last().text().trim().split(/\s+/).filter(Boolean);
      
      console.log('label:', label, 'nums:', numbers);
      
      if (label === "đặc biệt" || label === "đb") kqxs.dac_biet.push(...numbers);
      else if (label === "giải nhất" || label === "1") kqxs.giai_1.push(...numbers);
      else if (label === "giải nhì" || label === "2") kqxs.giai_2.push(...numbers);
      else if (label === "giải ba" || label === "3") kqxs.giai_3.push(...numbers);
      else if (label === "giải tư" || label === "4") kqxs.giai_4.push(...numbers);
      else if (label === "giải năm" || label === "5") kqxs.giai_5.push(...numbers);
      else if (label === "giải sáu" || label === "6") kqxs.giai_6.push(...numbers);
      else if (label === "giải bảy" || label === "7") kqxs.giai_7.push(...numbers);
    });

    console.log(kqxs);
  } catch(e) { console.error(e); }
}

scrapeXosoComVn('29-04-2026');
