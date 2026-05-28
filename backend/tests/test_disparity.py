import pytest
from core.disparity_analyzer import fetch_etf_disparity_list, get_etf_disparity

@pytest.mark.asyncio
async def test_fetch_etf_disparity_list():
    """
    Test that fetch_etf_disparity_list fetches and parses data from Naver Finance correctly.
    """
    disparity_map = await fetch_etf_disparity_list()
    assert isinstance(disparity_map, dict)
    assert len(disparity_map) > 0
    
    # Check that a common ETF code exists and contains correct keys
    # KODEX 200 is typically "069500"
    common_code = "069500"
    if common_code in disparity_map:
        info = disparity_map[common_code]
        assert "code" in info
        assert "name" in info
        assert "price" in info
        assert "nav" in info
        assert "disparity_rate" in info
        assert isinstance(info["disparity_rate"], float)

@pytest.mark.asyncio
async def test_get_etf_disparity_specific():
    """
    Test get_etf_disparity helper with standard and space-mapped codes.
    """
    # KODEX 200
    info = await get_etf_disparity("069500")
    if info:
        assert info["code"] == "069500"
        assert "KODEX 200" in info["name"]
        
    # Space mapped code test: "488050" should map to "0167Z0"
    info_mapped = await get_etf_disparity("488050")
    if info_mapped:
        assert info_mapped["code"] == "0167Z0"
