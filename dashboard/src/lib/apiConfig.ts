// Define a centralized API base URL to prevent logic drift across components
export const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:8000"
        : process.env.NEXT_PUBLIC_API_URL || "https://etf-lens.onrender.com";
