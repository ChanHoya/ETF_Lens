import pandas_datareader.data as web
import datetime
start = datetime.datetime(2020, 1, 1)
end = datetime.datetime(2020, 12, 31)
df = web.DataReader('KORLORSGPNOSTSAM', 'fred', start, end)
print(df.head())
