const fs = require('fs');

async function test() {
  const res = await fetch('http://localhost:8000/api/v1/exit-signal/macro');
  const data = await res.json();
  
  let months = 120;
  const sliced = data.slice(-months);

  const getBase = (key) => {
      const validItem = sliced.find((item) => typeof item[key] === 'number' && item[key] > 0);
      return validItem ? validItem[key] : 0;
  };

  const baseKrw = getBase('krw');
  const baseDollar = getBase('dollar');
  const baseKospi = getBase('kospi');
  const baseSp = getBase('sp500');

  console.log({baseKrw, baseDollar, baseKospi, baseSp});

  const resData = sliced.map((d) => ({
      ...d,
      indexedDollar: (typeof d.dollar === 'number' && baseDollar > 0) ? (d.dollar / baseDollar) * 100 : null,
      indexedKrw: (typeof d.krw === 'number' && baseKrw > 0) ? (d.krw / baseKrw) * 100 : null,
      indexedKospi: (typeof d.kospi === 'number' && baseKospi > 0) ? (d.kospi / baseKospi) * 100 : null,
      indexedSp500: (typeof d.sp500 === 'number' && baseSp > 0) ? (d.sp500 / baseSp) * 100 : null,
  }));
  
  console.log("Any nulls or NaNs in first 5 items?");
  console.log(resData.slice(0, 5));
}
test();
