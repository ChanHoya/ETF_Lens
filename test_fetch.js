async function test() {
  const r1 = await fetch('http://localhost:8000/api/v1/exit-signal/pe?symbol=005930');
  const d1 = await r1.json();
  console.log("005930 end val:", d1[d1.length-1]);

  const r2 = await fetch('http://localhost:8000/api/v1/exit-signal/pe?symbol=000660');
  const d2 = await r2.json();
  console.log("000660 end val:", d2[d2.length-1]);
}
test();
