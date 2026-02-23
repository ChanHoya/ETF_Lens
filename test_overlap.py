from backend.agents.quant.quant import ETFQuant

q = ETFQuant()
h1 = [{'ticker': 'A', 'weight': 10.0}]
h2 = [{'ticker': 'A', 'weight': 5.0}]
print(q.calculate_overlap(h1, h2))
