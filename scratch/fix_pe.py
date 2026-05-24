with open("backend/api/exit_signal.py", "r") as f:
    content = f.read()

content = content.replace(
    '''        logger.info(f"PE detail for {symbol}: {len(results)} pts, pe={real_pe:.1f}, last={results[-1]['val'] if results else 'N/A'}")
        return results''',
    '''        if target_ym:
            results = [r for r in results if r["month"][:7] <= target_ym]
        
        logger.info(f"PE detail for {symbol}: {len(results)} pts, pe={real_pe:.1f}, last={results[-1]['val'] if results else 'N/A'}")
        
        if target_ym:
            # get_exit_signal_data expects monthly data (last element per month) for 12 months, or just the current status.
            # actually get_pe_detail returns daily? no, it returns daily but get_exit_signal_data just takes the last one for current_status.
            pass
            
        return results'''
)

content = content.replace(
    'pe_data = await get_pe_detail("KOSPI")',
    'pe_data = await get_pe_detail("KOSPI", target_ym)'
)

with open("backend/api/exit_signal.py", "w") as f:
    f.write(content)
