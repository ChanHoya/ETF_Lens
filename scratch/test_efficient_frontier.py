import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from api.efficient_frontier import calculate_efficient_frontier, EfficientFrontierRequest, HoldingItem

async def main():
    print("Testing Efficient Frontier API backend logic...")
    
    # Test request with AAPL (US) and 005930 (Samsung Electronics)
    req = EfficientFrontierRequest(
        holdings=[
            HoldingItem(code="005930", amount=5000000, name="삼성전자"),
            HoldingItem(code="AAPL", amount=5000000, name="Apple"),
        ],
        lookback_years=1.0,
        risk_free_rate=3.0,
        simulations=1000
    )
    
    loop = asyncio.get_running_loop()
    start_time = loop.time()
    try:
        res = await calculate_efficient_frontier(req)
        end_time = loop.time()
        print(f"Calculation succeeded in {end_time - start_time:.2f} seconds!")
        print("\n=== Result Summary ===")
        print(f"Status: {res['status']}")
        print(f"Tickers: {list(res['tickers'].keys())}")
        
        # Max Sharpe
        ms = res['max_sharpe']
        print(f"\nMax Sharpe Portfolio:")
        print(f"  Return: {ms['return']:.2f}%")
        print(f"  Volatility: {ms['volatility']:.2f}%")
        print(f"  Sharpe: {ms['sharpe']:.2f}")
        print(f"  Weights: {ms['weights']}")
        
        # Min Var
        mv = res['min_var']
        print(f"\nMin Variance Portfolio:")
        print(f"  Return: {mv['return']:.2f}%")
        print(f"  Volatility: {mv['volatility']:.2f}%")
        print(f"  Sharpe: {mv['sharpe']:.2f}")
        print(f"  Weights: {mv['weights']}")
        
        # Current
        curr = res['current']
        print(f"\nCurrent Portfolio:")
        print(f"  Return: {curr['return']:.2f}%")
        print(f"  Volatility: {curr['volatility']:.2f}%")
        print(f"  Sharpe: {curr['sharpe']:.2f}")
        print(f"  Weights: {curr['weights']}")
        
        # Frontier size
        print(f"\nFrontier points count: {len(res['frontier'])}")
        print(f"Scatter points count: {len(res['scatter'])}")
        
    except Exception as e:
        print(f"Calculation failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
