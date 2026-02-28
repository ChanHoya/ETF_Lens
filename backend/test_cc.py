import asyncio
import sys
import os

sys.path.append(os.path.dirname(__file__))

from api.covered_call import CoveredCallRequest, analyze_covered_calls


async def main():
    req = CoveredCallRequest(
        fund_symbols=["JEPI", "JEPQ", "DIVO"], benchmark_symbol="^SP500TR", period="1y"
    )
    res = await analyze_covered_calls(req)
    print(res)


if __name__ == "__main__":
    asyncio.run(main())
