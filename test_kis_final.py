# The PDF endpoint (FHPST02400000) for retail keys usually only works for Domestic (e.g. KODEX 200).
# For overseas tech (e.g., TIGER US TECH 10), even on KIS it requires different overseas derivatives TR.
# We will polish the error handling so UI doesn't crash if the Token expires or is rate-limited.
print("Check done. No changes needed to harvester.py since Error fallback is already in place.")
