// Define a centralized API base URL to prevent logic drift across components
export const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://etf-lens.onrender.com");
