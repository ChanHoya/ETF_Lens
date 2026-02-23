const vals = ["연 0.05%", "연 0.49%", "연 0.01%", "연 0.45%", "연 0.09%"];
const parsed = vals.map(v => {
    let raw = String(v).replace(/,/g, '');
    let num = parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
    return num;
});
let max = Math.max(1, ...parsed);
console.log("Parsed:", parsed);
console.log("Max:", max);
parsed.forEach(n => {
    let ratio = n / max;
    let visHeight = Math.min(100, Math.max(4, Math.pow(ratio, 0.45) * 100));
    console.log(`${n} -> ratio: ${ratio}, visHeight: ${visHeight}`);
});
