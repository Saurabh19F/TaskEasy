'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';

export function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section ref={containerRef} className="relative min-h-screen pt-24 pb-16 px-4 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-surface to-background" />
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
          animate={{
            x: mousePosition.x * 20,
            y: mousePosition.y * 20,
          }}
          transition={{ type: 'spring', stiffness: 50, damping: 30 }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            x: -mousePosition.x * 20,
            y: -mousePosition.y * 20,
          }}
          transition={{ type: 'spring', stiffness: 50, damping: 30 }}
        />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-container/50 backdrop-blur-sm mb-6"
        >
          <span className="text-xs font-medium text-primary">★ Trusted by 100+ companies</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent"
        >
          Turn every responsibility
          <br />
          <span className="text-primary">into visible progress</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
        >
          TaskEasy brings tasks, delegations, checklists, workflows and team accountability into one intelligent work operating system.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
        >
          <Link href="/company/login">
            <Button size="lg" className="gap-2">
              Start Managing Work <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <button className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-surface-container transition-colors group">
            <Play className="h-5 w-5 text-primary group-hover:text-primary" fill="currentColor" />
            <span className="font-medium">Watch Demo</span>
          </button>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-col sm:flex-row justify-center gap-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary">✓</span> No credit card required
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">✓</span> Setup in minutes
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">✓</span> Free 14-day trial
          </div>
        </motion.div>
      </div>

      {/* Hero Visual - Workflow Animation */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5 }}
        className="mt-16 max-w-4xl mx-auto"
      >
        <div className="rounded-2xl border border-border bg-surface-container/30 backdrop-blur-sm p-1 overflow-hidden">
          {/* Workflow diagram */}
          <svg className="w-full h-auto min-h-96" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
            {/* Workflow nodes */}
            {[
              { x: 100, label: 'Request', color: '#2563EB' },
              { x: 300, label: 'Assign', color: '#7C3AED' },
              { x: 500, label: 'Execute', color: '#10B981' },
              { x: 700, label: 'Review', color: '#F59E0B' },
              { x: 900, label: 'Complete', color: '#06B6D4' },
            ].map((node, idx) => (
              <g key={idx}>
                {/* Connecting line */}
                {idx < 4 && (
                  <motion.line
                    x1={node.x + 30}
                    y1={200}
                    x2={[300, 500, 700, 900][idx] - 30}
                    y2={200}
                    stroke={node.color}
                    strokeWidth="2"
                    opacity="0.3"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.6 + idx * 0.2 }}
                  />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={200}
                  r="30"
                  fill={node.color}
                  opacity="0.1"
                  stroke={node.color}
                  strokeWidth="2"
                />
                <circle
                  cx={node.x}
                  cy={200}
                  r="20"
                  fill={node.color}
                  opacity="0.8"
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={260}
                  textAnchor="middle"
                  className="text-sm font-medium fill-foreground"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </motion.div>
    </section>
  );
}
