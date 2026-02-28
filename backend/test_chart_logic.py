import pandas as pd
import yfinance as yf

# simulate /chart
bench_df = yf.download("SCHD", period="1y")["Adj Close"]
fund_df = yf.download("458730.KS", period="1y")["Adj Close"]

df_all = pd.DataFrame({"Benchmark": bench_df, "Fund": fund_df})
print("Before dropna len:", len(df_all))
df_all = df_all.dropna()
print("After dropna len:", len(df_all))
print(df_all.head())
print(df_all.tail())
df_all = (df_all / df_all.iloc[0]) * 100
print("Chart End Return Fund:", df_all["Fund"].iloc[-1] - 100)
print("Chart End Return Bench:", df_all["Benchmark"].iloc[-1] - 100)

print("Analyze Fund Return:", (fund_df.iloc[-1] / fund_df.iloc[0] - 1) * 100)
print("Analyze Bench Return:", (bench_df.iloc[-1] / bench_df.iloc[0] - 1) * 100)

