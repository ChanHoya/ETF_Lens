import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from api.my_assets import get_my_portfolio
from db.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        try:
            portfolio = await get_my_portfolio(request=None, db=db)
            print("Portfolio fetch success!")
            
            # Check holdings
            kis_raw = portfolio.get("kis_raw", {})
            summary = kis_raw.get("summary", {})
            holdings = kis_raw.get("holdings", [])
            
            print(f"Total holdings: {len(holdings)}")
            print(f"Weighted disparity rate in summary: {summary.get('weighted_disparity_rate')}%")
            
            # Print holdings with disparity
            for h in holdings[:5]:
                print(f"Asset: {h.get('name')} ({h.get('code')})")
                print(f"  Price: {h.get('current_price')} | NAV: {h.get('nav')} | Disparity: {h.get('disparity_rate')}%")
                
        except Exception as e:
            print(f"Error fetching portfolio: {e}")

if __name__ == "__main__":
    asyncio.run(main())
