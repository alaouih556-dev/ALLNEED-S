import { useState } from "react";
import { SERVICES, type NeedId } from "@/data/services";
import { useAppStore } from "@/lib/store";

const NODE_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 15 },
  { x: 79.4, y: 26 },
  { x: 85, y: 50 },
  { x: 79.4, y: 74 },
  { x: 50, y: 85 },
  { x: 20.6, y: 74 },
  { x: 15, y: 50 },
  { x: 20.6, y: 26 },
];

const NODES: { id: NeedId; label: string; x: number; y: number }[] =
  SERVICES.map((service, index) => ({
    id: service.id,
    label: service.shortTitle,
    ...(NODE_POSITIONS[index] ?? NODE_POSITIONS[0]),
  }));

const OUTER = [
  { label: "Partenaires", x: 50, y: 5.4 },
  { label: "Solutions", x: 88, y: 92 },
  { label: "Accompagnement", x: 12, y: 92 },
];

export function NetworkDiagram() {
  const [hover, setHover] = useState<NeedId | null>(null);
  const openService = useAppStore((s) => s.openService);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        role="img"
        aria-label={`Réseau ALLNEEDS reliant les ${SERVICES.length} besoins aux partenaires, solutions et accompagnement`}
      >
        <defs>
          <linearGradient id="an-stroke" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1268E8" />
            <stop offset="55%" stopColor="#168BFF" />
            <stop offset="100%" stopColor="#12BDF3" />
          </linearGradient>
        </defs>

        {OUTER.map((node) => (
          <path
            key={node.label}
            d={`M 50 50 Q ${(50 + node.x) / 2} ${(50 + node.y) / 2} ${node.x} ${node.y}`}
            fill="none"
            stroke="url(#an-stroke)"
            strokeWidth="0.22"
            opacity="0.28"
            className="flow-line"
          />
        ))}

        {NODES.map((node) => {
          const active = hover === node.id;
          return (
            <path
              key={node.id}
              d={`M 50 50 C ${(50 + node.x) / 2 - 6} ${(50 + node.y) / 2 + 3}, ${(50 + node.x) / 2 + 5} ${(50 + node.y) / 2 - 4}, ${node.x} ${node.y}`}
              fill="none"
              stroke="url(#an-stroke)"
              strokeWidth={active ? 0.7 : 0.34}
              opacity={hover && !active ? 0.16 : 0.95}
              className="flow-line"
              style={{ transition: "opacity 200ms, stroke-width 200ms" }}
            />
          );
        })}

        <circle
          cx="50"
          cy="50"
          r="10.8"
          fill="#07172F"
          stroke="url(#an-stroke)"
          strokeWidth="0.7"
        />
        <text
          x="50"
          y="49"
          textAnchor="middle"
          fill="#12BDF3"
          fontSize="2.1"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight="700"
          letterSpacing="0.35"
        >
          ALL
        </text>
        <text
          x="50"
          y="53.4"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="3.1"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight="800"
        >
          NEEDS
        </text>

        {OUTER.map((node) => (
          <text
            key={node.label}
            x={node.x}
            y={node.y + 0.6}
            textAnchor="middle"
            fill="#12BDF3"
            fontSize="1.7"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="700"
          >
            {node.label.toUpperCase()}
          </text>
        ))}

        {NODES.map((node) => {
          const active = hover === node.id;
          const service = SERVICES.find((s) => s.id === node.id);
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`Ouvrir ${service?.title ?? node.label}`}
              className="cursor-pointer"
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(node.id)}
              onBlur={() => setHover(null)}
              onClick={() => openService(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openService(node.id);
                }
              }}
            >
              <rect
                x={node.x - 10.4}
                y={node.y - 3.4}
                width="20.8"
                height="6.8"
                rx="1.1"
                fill={active ? "#F4F9FF" : "#0c2a5a"}
                stroke={active ? "#12BDF3" : "rgba(255,255,255,0.18)"}
                strokeWidth="0.28"
              />
              <text
                x={node.x}
                y={node.y + 0.8}
                textAnchor="middle"
                fill={active ? "#07172F" : "#ffffff"}
                fontSize="2.05"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="700"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
