import os
import math
import logging
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db.database import get_db
from api.my_assets import get_my_portfolio

logger = logging.getLogger(__name__)

router = APIRouter()

# Schema for rebalance recommendations
class RecommendationItem(BaseModel):
    code: str
    name: str
    action: str # "KEEP", "REPLACE", "ADD"
    reasoning: str
    alternative_etf: Optional[str] = None

class OrderRouteRequest(BaseModel):
    recommendations: List[RecommendationItem]

# In-memory virtual overlay to simulate executing the trades
# Key: user_id or session, Value: simulated holdings & cash
_VIRTUAL_PORTFOLIO_OVERLAY: Dict[str, Dict[str, Any]] = {}

def parse_alternative_code(alternative_str: Optional[str]) -> Optional[str]:
    """Parses alternative ETF string like '396500 (TIGER 반도체TOP10)' and returns the 6-digit code."""
    if not alternative_str:
        return None
    cleaned = alternative_str.strip()
    # Find first 6 consecutive digits
    digits = ""
    for char in cleaned:
        if char.isdigit():
            digits += char
        elif digits and len(digits) >= 6:
            break
        else:
            digits = ""
    if len(digits) == 6:
        return digits
    return None

async def get_etf_price(code: str, db: AsyncSession) -> float:
    """Gets the latest daily close or market price for an ETF code."""
    from sqlalchemy import select
    from db.models import ETFMaster, ETFDailyPrice
    try:
        # Try daily price first
        price_result = await db.execute(
            select(ETFDailyPrice.price)
            .where(ETFDailyPrice.code == code)
            .order_by(ETFDailyPrice.date.desc())
            .limit(1)
        )
        p = price_result.scalar_one_or_none()
        if p is not None:
            return float(p)
            
        # Try etf master price
        master_result = await db.execute(
            select(ETFMaster.price).where(ETFMaster.code == code)
        )
        p = master_result.scalar_one_or_none()
        if p is not None:
            return float(p)
    except Exception as e:
        logger.error(f"Error fetching ETF price for {code}: {e}")
    return 15000.0  # Safe fallback default price

@router.post("/route")
async def calculate_order_routing(
    request: Request,
    payload: OrderRouteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculates precise BUY/SELL orders across multiple KIS accounts based on AI recommendations.
    This routes replaces/adds using the exact holdings in those accounts.
    """
    try:
        portfolio = await get_my_portfolio(request=request, db=db)
        kis_raw = portfolio.get("kis_raw", {})
        holdings = kis_raw.get("holdings", [])
        accounts = kis_raw.get("accounts", [])
        
        # Build lookup maps
        recs_map = {item.code: item for item in payload.recommendations}
        holdings_by_code = {}
        for h in holdings:
            code = h["code"]
            if code not in holdings_by_code:
                holdings_by_code[code] = []
            holdings_by_code[code].append(h)
            
        orders = []
        total_sell_volume = 0.0
        total_buy_volume = 0.0
        
        # Process each recommendation
        for code, rec in recs_map.items():
            if rec.action == "REPLACE":
                # User needs to SELL this ETF and BUY the alternative in the same accounts
                alternative_code = parse_alternative_code(rec.alternative_etf)
                if not alternative_code:
                    logger.warning(f"Could not parse alternative code from: {rec.alternative_etf}")
                    continue
                
                # Fetch price of the alternative asset
                alt_price = await get_etf_price(alternative_code, db)
                alt_name = rec.alternative_etf.split("(")[-1].replace(")", "").strip() if "(" in rec.alternative_etf else "대안 ETF"
                
                # Find all active holdings for the source code
                matching_holdings = holdings_by_code.get(code, [])
                for h in matching_holdings:
                    acc_no = h["account_no"]
                    qty = h["qty"]
                    curr_price = h["current_price"]
                    sell_amount = qty * curr_price
                    
                    # 1. Add Sell Order
                    orders.append({
                        "account_no": acc_no,
                        "side": "SELL",
                        "code": code,
                        "name": h["name"],
                        "qty": qty,
                        "price": curr_price,
                        "amount": sell_amount,
                        "status": "pending",
                        "reason": f"AI 권고: {h['name']} 대비 성과 우수한 대안종목 교체 매도"
                    })
                    total_sell_volume += sell_amount
                    
                    # 2. Add matching Buy Order using the gained cash
                    buy_qty = math.floor(sell_amount / alt_price)
                    if buy_qty > 0:
                        buy_amount = buy_qty * alt_price
                        orders.append({
                            "account_no": acc_no,
                            "side": "BUY",
                            "code": alternative_code,
                            "name": alt_name,
                            "qty": buy_qty,
                            "price": alt_price,
                            "amount": buy_amount,
                            "status": "pending",
                            "reason": f"AI 권고: 교체 매도 자금으로 {alt_name} 매수"
                        })
                        total_buy_volume += buy_amount
            
            elif rec.action == "ADD":
                # Buy a new asset using cash balance from the account with the largest cash
                alt_code = parse_alternative_code(rec.alternative_etf) or rec.code
                alt_price = await get_etf_price(alt_code, db)
                alt_name = rec.name
                
                # Find account with largest cash balance
                largest_acc = None
                largest_cash = -1.0
                for acc in accounts:
                    cash = float(acc.get("cash_balance", 0))
                    if cash > largest_cash:
                        largest_cash = cash
                        largest_acc = acc["account_no"]
                        
                if largest_acc and largest_cash > alt_price:
                    # Allocate 10% of cash for this asset
                    target_allocation = largest_cash * 0.1
                    buy_qty = math.floor(target_allocation / alt_price)
                    if buy_qty > 0:
                        buy_amount = buy_qty * alt_price
                        orders.append({
                            "account_no": largest_acc,
                            "side": "BUY",
                            "code": alt_code,
                            "name": alt_name,
                            "qty": buy_qty,
                            "price": alt_price,
                            "amount": buy_amount,
                            "status": "pending",
                            "reason": f"AI 권고: 여유 예수금 활용 {alt_name} 신규 편입"
                        })
                        total_buy_volume += buy_amount
                        
        return {
            "status": "success",
            "total_sell_volume": total_sell_volume,
            "total_buy_volume": total_buy_volume,
            "net_cash_change": total_sell_volume - total_buy_volume,
            "orders": orders
        }
        
    except Exception as e:
        logger.exception("Error calculating order routing")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execute-virtual")
async def execute_virtual_orders(
    request: Request,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates executing the calculated orders virtually and updates the virtual overlay portfolio cache.
    """
    try:
        user_id = "default_user"
        orders = payload.get("orders", [])
        if not orders:
            raise HTTPException(status_code=400, detail="No orders provided for execution")
            
        # Get active portfolio
        portfolio = await get_my_portfolio(request=request, db=db)
        kis_raw = portfolio.get("kis_raw", {})
        holdings = list(kis_raw.get("holdings", []))
        accounts = list(kis_raw.get("accounts", []))
        
        # Apply simulated orders to holdings & account balances
        holdings_map = {(h["account_no"], h["code"]): h for h in holdings}
        accounts_map = {acc["account_no"]: acc for acc in accounts}
        
        executed_logs = []
        
        for order in orders:
            acc_no = order["account_no"]
            side = order["side"]
            code = order["code"]
            qty = int(order["qty"])
            price = float(order["price"])
            amount = float(order["amount"])
            
            # Update account cash
            if acc_no in accounts_map:
                acc = accounts_map[acc_no]
                current_cash = float(acc.get("cash_balance", 0))
                if side == "SELL":
                    acc["cash_balance"] = current_cash + amount
                    acc["total_asset"] = float(acc.get("total_asset", 0)) + amount
                else:
                    acc["cash_balance"] = current_cash - amount
                    acc["total_asset"] = float(acc.get("total_asset", 0)) - amount
            
            # Update holdings
            key = (acc_no, code)
            if side == "SELL":
                if key in holdings_map:
                    h = holdings_map[key]
                    current_qty = int(h["qty"])
                    if current_qty <= qty:
                        # Fully sold out
                        holdings = [item for item in holdings if not (item["account_no"] == acc_no and item["code"] == code)]
                    else:
                        h["qty"] = current_qty - qty
                        h["eval_amount"] = float(h["eval_amount"]) - amount
                        h["profit_loss"] = float(h["profit_loss"]) * (1 - qty/current_qty)
            else: # BUY
                if key in holdings_map:
                    h = holdings_map[key]
                    h["qty"] = int(h["qty"]) + qty
                    h["eval_amount"] = float(h["eval_amount"]) + amount
                else:
                    # New holding
                    new_h = {
                        "code": code,
                        "name": order.get("name", "신규종목"),
                        "qty": qty,
                        "avg_price": price,
                        "current_price": price,
                        "eval_amount": amount,
                        "profit_loss": 0.0,
                        "return_rate": 0.0,
                        "account_no": acc_no
                    }
                    holdings.append(new_h)
            
            executed_logs.append({
                "account_no": acc_no,
                "side": side,
                "code": code,
                "name": order.get("name", ""),
                "qty": qty,
                "price": price,
                "amount": amount,
                "timestamp": order.get("timestamp", "")
            })
            
        # Re-calculate total portfolio totals
        total_eval = sum(float(h["eval_amount"]) for h in holdings)
        total_cash = sum(float(acc["cash_balance"]) for acc in accounts)
        
        simulated_portfolio = {
            "status": "success",
            "kis_raw": {
                "summary": {
                    "total_eval_amount": total_eval,
                    "total_profit_loss": sum(float(h.get("profit_loss", 0)) for h in holdings),
                    "cash_balance": total_cash,
                    "total_asset": total_eval + total_cash,
                },
                "holdings": holdings,
                "accounts": accounts,
            },
            "is_simulated": True,
            "executed_orders": executed_logs
        }
        
        # Save virtual overlay to session cache
        _VIRTUAL_PORTFOLIO_OVERLAY[user_id] = simulated_portfolio
        
        return {
            "status": "success",
            "message": "Simulated orders executed successfully.",
            "simulated_portfolio": simulated_portfolio
        }
        
    except Exception as e:
        logger.exception("Error executing virtual orders")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/simulated-portfolio")
async def get_simulated_portfolio():
    """Gets the currently active simulated rebalanced portfolio if any."""
    user_id = "default_user"
    simulated = _VIRTUAL_PORTFOLIO_OVERLAY.get(user_id)
    return {
        "status": "success",
        "has_simulated": simulated is not None,
        "data": simulated
    }

@router.delete("/simulated-portfolio")
async def reset_simulated_portfolio():
    """Resets the simulation to match original actual KIS account balances."""
    user_id = "default_user"
    if user_id in _VIRTUAL_PORTFOLIO_OVERLAY:
        del _VIRTUAL_PORTFOLIO_OVERLAY[user_id]
    return {
        "status": "success",
        "message": "Virtual overlay reset successfully."
    }
