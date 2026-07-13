'use client';

import { useEffect, useState } from 'react';

const metrics = [
  { value: 50000, suffix: '+', label: 'Tasks Completed Daily' },
  { value: 99.9, suffix: '%', label: 'Uptime SLA' },
  { value: 120, suffix: '+', label: 'Companies Trust Us' },
  { value: 4.9, suffix: '/5', label: 'Customer Rating' },
];

function AnimatedCounter({ target, suffix, duration = 2, delay = 0 }: { target: number; suffix: string; duration?: number; delay?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current * 10) / 10);
      }
    }, (duration * 1000) / steps);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  const display = target >= 100 ? Math.floor(count).toLocaleString() : count.toFixed(1);

  return (
    <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
      {display}{suffix}
    </div>
  );
}

export function MetricsStrip() {
  return (
    <section className="py-12 border-y border-border bg-surface-container/30">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((m, i) => (
            <div key={m.label} className="text-center">
              <AnimatedCounter target={m.value} suffix={m.suffix} delay={300 + i * 150} />
              <div className="text-sm text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
