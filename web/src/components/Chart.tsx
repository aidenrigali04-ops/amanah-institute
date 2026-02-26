import { useEffect, useRef } from "react";
import { createChart, IChartApi, CandlestickData } from "lightweight-charts";

interface ChartProps {
  data: CandlestickData[];
}

export default function Chart({ data }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0d1117" },
        textColor: "#8b949e",
        fontFamily: "Outfit, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#21262d" },
        horzLines: { color: "#21262d" },
      },
      rightPriceScale: {
        borderColor: "#30363d",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#30363d",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "#58a6ff" },
        horzLine: { labelBackgroundColor: "#58a6ff" },
      },
    });
    const candlestick = chart.addCandlestickSeries({
      upColor: "#3fb950",
      downColor: "#f85149",
      borderDownColor: "#f85149",
      borderUpColor: "#3fb950",
      wickDownColor: "#f85149",
      wickUpColor: "#3fb950",
    });
    candlestick.setData(data);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div className="chart-wrapper">
      <div className="chart-container" ref={containerRef} />
    </div>
  );
}
