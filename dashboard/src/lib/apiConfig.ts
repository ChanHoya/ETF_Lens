// Define a centralized API base URL to prevent logic drift across components
export const getApiBase = (): string => {
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "http://localhost:8000";
  }
  return process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://etf-lens.onrender.com");
};

export const API_BASE =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000"
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

