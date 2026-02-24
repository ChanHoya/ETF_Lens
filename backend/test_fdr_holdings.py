import FinanceDataReader as fdr


def test_fdr(code):
    try:
        # FinanceDataReader doesn't natively fetch holdings for Korean ETFs
        # let's try if it exists.
        print(fdr.__version__)
    except Exception as e:
        print(e)


test_fdr("360750")
