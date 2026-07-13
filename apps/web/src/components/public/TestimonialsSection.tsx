'use client';

import { motion } from 'framer-motion';
import { Quote, TrendingUp, Clock3, ShieldAlert } from 'lucide-react';

const testimonials = [
  {
    quote:
      'TaskEasy gave us one place to run delegation, approvals, and MIS without chasing updates across WhatsApp and spreadsheets.',
    name: 'Aman Verma',
    role: 'Operations Head',
    company: 'BuildGrid Infra',
  },
  {
    quote:
      'The rework and proof flow made accountability visible overnight. We finally know what is pending, delayed, and truly completed.',
    name: 'Priya Nair',
    role: 'Admin Manager',
    company: 'NorthBridge Services',
  },
  {
    quote:
      'Checklist and FMS tracking reduced follow-up noise dramatically. Our field teams now work with much clearer expectations.',
    name: 'Rohit Shah',
    role: 'Project Director',
    company: 'UrbanSpan Projects',
  },
];

const proofPoints = [
  {
    icon: TrendingUp,
    title: 'Performance visibility',
    description: 'MIS cards and score snapshots make employee trends visible before delays become cultural.',
  },
  {
    icon: Clock3,
    title: 'Faster approvals',
    description: 'Structured submission, proof, and review flows shorten the gap between done and approved.',
  },
  {
    icon: ShieldAlert,
    title: 'Less work slipping through',
    description: 'Status cycles, reminders, and hierarchy-based visibility keep pending work from going dark.',
  },
];

export function TestimonialsSection() {
  return (
    <section id="proof" className="py-24 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
            Customer Proof
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for teams that need operational discipline
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            TaskEasy is designed for organizations where visibility, follow-through, and timely approvals directly affect delivery.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3 mb-12">
          {testimonials.map((item, idx) => (
            <motion.div
              key={`${item.name}-${item.company}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="rounded-3xl border border-border bg-surface p-8"
            >
              <Quote className="h-8 w-8 text-primary/70 mb-5" />
              <p className="text-foreground leading-7 mb-6">{item.quote}</p>
              <div className="text-sm font-semibold text-foreground">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                {item.role}, {item.company}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {proofPoints.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="rounded-2xl border border-border bg-surface-container/30 p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
