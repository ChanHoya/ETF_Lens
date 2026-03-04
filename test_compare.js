fetch('http://localhost:8000/api/v1/analyze/compare/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etf_codes: ["069500", "229200"], skip_holdings: true })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
