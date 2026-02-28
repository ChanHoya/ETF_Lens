from pykrx import stock
import inspect
print(inspect.signature(stock.get_market_fundamental))
print(stock.get_market_fundamental_by_ticker("20240104").head())
print(stock.get_market_fundamental("20240101", "20240131", "005930").head())
