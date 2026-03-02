import os
import yfinance as yf
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def generate_macro_charts(output_dir="/tmp"):
    """
    Downloads VIX and KRW=X for the past 6 months and saves line charts as images.
    Returns a dict with Content-ID mapping to the generated chart paths.
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        paths = {}

        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)

        # Download data
        try:
            df_vix = yf.download(
                "^VIX",
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                progress=False,
            )
            df_krw = yf.download(
                "KRW=X",
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                progress=False,
            )
            df_kospi = yf.download(
                "^KS11",
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                progress=False,
            )
        except Exception as e:
            logger.error(f"Yfinance download failed: {e}")
            return paths

        # Plot VIX
        if not df_vix.empty:
            close_prices = (
                df_vix["Close"] if "Close" in df_vix.columns else df_vix.iloc[:, 0]
            )
            close_prices = close_prices.dropna()

            plt.figure(figsize=(6, 3))
            plt.plot(close_prices.index, close_prices, color="#8b5cf6", linewidth=2)
            plt.axhline(
                y=20, color="#ef4444", linestyle="--", alpha=0.7, label="Warning (20)"
            )
            plt.title("VIX Index (Last 6 Months)")
            plt.grid(True, alpha=0.2)
            plt.gca().xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
            plt.tight_layout()

            vix_path = os.path.join(output_dir, "vix_chart.png")
            plt.savefig(vix_path, dpi=150, bbox_inches="tight")
            plt.close()
            paths["vix_chart"] = vix_path

        # Plot KRW
        if not df_krw.empty:
            close_prices = (
                df_krw["Close"] if "Close" in df_krw.columns else df_krw.iloc[:, 0]
            )
            close_prices = close_prices.dropna()

            plt.figure(figsize=(6, 3))
            plt.plot(close_prices.index, close_prices, color="#3b82f6", linewidth=2)
            plt.axhline(
                y=1400,
                color="#ef4444",
                linestyle="--",
                alpha=0.7,
                label="Warning (1400)",
            )
            plt.title("USD/KRW Exchange Rate (Last 6 Months)")
            plt.grid(True, alpha=0.2)
            plt.gca().xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
            plt.tight_layout()

            krw_path = os.path.join(output_dir, "krw_chart.png")
            plt.savefig(krw_path, dpi=150, bbox_inches="tight")
            plt.close()
            paths["krw_chart"] = krw_path

        return paths
    except Exception as e:
        logger.error(f"Error generating charts: {e}")
        return {}
