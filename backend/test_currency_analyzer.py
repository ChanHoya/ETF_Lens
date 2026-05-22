import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.database import AsyncSessionLocal
from core.currency_analyzer import get_currency_hedged_pairs, analyze_fx_impact


async def test():
    async with AsyncSessionLocal() as db:
        try:
            # 1. Currency pairs detection test
            pairs = await get_currency_hedged_pairs(db)
            print(f"FOUND {len(pairs)} CURRENCY PAIRS.")
            if pairs:
                first = pairs[0]
                print(f"SAMPLE PAIR: {first['hedged']['name']} ({first['hedged']['code']}) <-> {first['unhedged']['name']} ({first['unhedged']['code']})")
                
                # 2. FX Impact analysis simulation test for the first pair
                analysis = await analyze_fx_impact(db, first['hedged']['code'], first['unhedged']['code'])
                
                print("\n--- STATISTICS ---")
                import pprint
                pprint.pprint(analysis["statistics"])
                
                print("\n--- SCENARIOS ---")
                pprint.pprint(analysis["scenarios"])
                
                print("\nCHART DATA LENGTH:", len(analysis["chart_data"]))
            else:
                print("No currency pairs detected.")
        except Exception as e:
            print("ERROR", e)


if __name__ == "__main__":
    asyncio.run(test())
