import FinanceDataReader as fdr

if __name__ == "__main__":
    for ticker in ["US500", "IXIC", "S&P500", "SPX"]:
        try:
            df = fdr.DataReader(ticker)
            print(f"{ticker}: {len(df)} rows, last closing: {df.iloc[-1]['Close']}")
        except Exception as e:
            print(f"{ticker}: failed - {e}")
