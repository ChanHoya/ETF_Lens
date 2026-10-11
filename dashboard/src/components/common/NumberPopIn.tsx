"use client";

import React, { useEffect, useState, useRef } from "react";

export interface NumberPopInProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  className?: string;
  isCurrency?: boolean;
  decimals?: number;
}

export function NumberPopIn({
  value,
  prefix = "",
  suffix = "",
  className = "",
  isCurrency = false,
  decimals,
}: NumberPopInProps) {
  const [animKey, setAnimKey] = useState(0);
  const prevValRef = useRef(value);

  useEffect(() => {
    if (prevValRef.current !== value) {
      prevValRef.current = value;
      setAnimKey((k) => k + 1);
    }
  }, [value]);

  const formattedValue = React.useMemo(() => {
    if (typeof value === "number") {
      let formatted: string;
      if (decimals !== undefined) {
        formatted = value.toLocaleString("ko-KR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      } else if (isCurrency) {
        formatted = Math.round(value).toLocaleString("ko-KR");
      } else {
        formatted = value.toLocaleString("ko-KR");
      }
      return formatted;
    }
    return String(value);
  }, [value, isCurrency, decimals]);

  return (
    <span key={animKey} className={`inline-block t-number-pop ${className}`}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

export default NumberPopIn;
