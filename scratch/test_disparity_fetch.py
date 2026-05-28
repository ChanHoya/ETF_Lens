import asyncio
from core.disparity_analyzer import get_etf_disparity, fetch_etf_disparity_list

async def main():
    print("Fetching full list...")
    full_list = await fetch_etf_disparity_list()
    print("Full list length:", len(full_list))
    
    # Test specific codes
    test_codes = ["069500", "360750", "488050"]  # KODEX 200, TIGER 미국S&P500, KODEX 미국우주항공
    for code in test_codes:
        result = await get_etf_disparity(code)
        if result:
            print(f"\nETF {code}:")
            print(f"  Name: {result['name']}")
            print(f"  Price: {result['price']}")
            print(f"  NAV: {result['nav']}")
            print(f"  Disparity: {result['disparity_rate']}%")
        else:
            print(f"\nETF {code}: Not found")
            
    # Search for "우주" or "488" in full_list
    print("\nSearching for '우주' in full list:")
    for k, v in full_list.items():
        if "우주" in v["name"] or "488050" in k:
            print(f"- {k}: {v['name']} (Price={v['price']}, NAV={v['nav']})")


if __name__ == "__main__":
    asyncio.run(main())
