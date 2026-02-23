const data = [
  "1,207,389주 / 9,411백만원",
  "14,247,083주 / 29,348백만원",
  "125,310주 / 3,556백만원",
  "203,487주 / 3,565백만원",
  "11,335주 / 465백만원"
];
let maxVal1 = 1;
let maxVal2 = 1;

const parsedVals = data.map(v => {
  let raw = String(v).replace(/,/g, '');
  const parts = raw.split('/');
  let n1 = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
  let n2 = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
  return [n1, n2];
});

maxVal1 = Math.max(1, ...parsedVals.map(p => p[0]));
maxVal2 = Math.max(1, ...parsedVals.map(p => p[1]));

console.log('Max1:', maxVal1);
console.log('Max2:', maxVal2);
data.forEach(v => {
  let raw = String(v).replace(/,/g, '');
  const parts = raw.split('/');
  let n1 = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
  let n2 = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
  console.log(`${v} -> H1: ${(n1/maxVal1*100).toFixed(2)}%, H2: ${(n2/maxVal2*100).toFixed(2)}%`);
});
