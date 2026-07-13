'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, AlertCircle, User } from 'lucide-react';

const steps = [
  { id: 'request', label: 'Request', icon: AlertCircle, color: '#2563EB', description: 'A task is created with priority, deadline, and requirements.' },
  { id: 'assign', label: 'Assign', icon: User, color: '#7C3AED', description: 'Automatically or manually assigned to the right team member.' },
  { id: 'execute', label: 'Execute', icon: Clock, color: '#10B981', description: 'Team works on the task with real-time progress tracking.' },
  { id: 'review', label: 'Review', icon: AlertCircle, color: '#F59E0B', description: 'Completed work is reviewed and approved by stakeholders.' },
  { id: 'complete', label: 'Complete', icon: CheckCircle2, color: '#06B6D4', description: 'Task is marked done with full audit trail and metrics.' },
];

export function WorkflowSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="product" className="py-24 px-4 bg-surface-container/20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            From chaos to clarity in 5 steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every task follows a structured workflow that ensures nothing falls through the cracks.
          </p>
        </motion.div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-12 flex-wrap">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeStep === idx
                    ? 'bg-primary text-contrast shadow-md'
                    : 'bg-surface border border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <step.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
              )}
            </div>
          ))}
        </div>

        {/* Active Step Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-border bg-surface p-8 md:p-12 text-center"
          >
            <div
              className="h-16 w-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: `${steps[activeStep].color}15` }}
            >
              {(() => {
                const Icon = steps[activeStep].icon;
                return <Icon className="h-8 w-8" style={{ color: steps[activeStep].color }} />;
              })()}
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Step {activeStep + 1}: {steps[activeStep].label}
            </h3>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              {steps[activeStep].description}
            </p>

            {/* Progress bar */}
            <div className="mt-8 flex gap-2 justify-center">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx <= activeStep ? 'w-12 bg-primary' : 'w-6 bg-border'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
