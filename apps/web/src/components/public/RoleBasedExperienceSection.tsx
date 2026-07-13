'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Users, UserRound, ArrowRight, CheckCircle2 } from 'lucide-react';

const roles = [
  {
    id: 'super-admin',
    label: 'Super Admin',
    icon: ShieldCheck,
    headline: 'Control the full operating system from one command center.',
    summary:
      'Oversee users, hierarchy, approvals, MIS, reports, FMS, and platform-wide accountability without losing visibility across teams.',
    modules: ['Global dashboard', 'Users and hierarchy', 'MIS and reports', 'Approvals and rework'],
    outcomes: ['Sees every team and project', 'Manages roles, status, and access', 'Tracks weekly score trends'],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Users,
    headline: 'Run day-to-day operations for your team with less follow-up.',
    summary:
      'Assign delegations, raise work requests, review submissions, and monitor team execution across projects, checklists, and FMS tasks.',
    modules: ['Team dashboard', 'Delegation and checklist assignment', 'Approve / Review queue', 'Team MIS and reports'],
    outcomes: ['Sees only hierarchy-owned teams', 'Approves or sends work to rework', 'Keeps delays and bottlenecks visible'],
  },
  {
    id: 'employee',
    label: 'Employee',
    icon: UserRound,
    headline: 'Know exactly what to do next and what needs proof.',
    summary:
      'Get one clean view for pending work, checklist items, FMS steps, and approvals so tasks move forward without confusion.',
    modules: ['My dashboard', 'Pending delegation tasks', 'Checklist and FMS work', 'Submission history'],
    outcomes: ['Sees only personal work', 'Submits remarks and attachments', 'Tracks approval status clearly'],
  },
];

export function RoleBasedExperienceSection() {
  const [activeRole, setActiveRole] = useState(roles[0]);

  return (
    <section id="solutions" className="py-24 px-4 bg-surface-container/20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
            Role-Based Experience
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            One platform, three clear operating views
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            TaskEasy is built around the real flow of accountability: leadership gets visibility, managers get control,
            and employees get clarity.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {roles.map((role) => {
            const Icon = role.icon;
            const isActive = activeRole.id === role.id;

            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary bg-primary text-contrast shadow-md'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {role.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
          >
            <div className="rounded-3xl border border-border bg-surface p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <activeRole.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-primary">{activeRole.label}</div>
                  <h3 className="text-2xl font-bold text-foreground">{activeRole.headline}</h3>
                </div>
              </div>

              <p className="text-muted-foreground text-base leading-7 mb-8">{activeRole.summary}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {activeRole.modules.map((module) => (
                  <div key={module} className="rounded-2xl border border-border bg-surface-container/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      {module}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-8">
              <div className="text-sm font-semibold text-foreground mb-5">What this role gets</div>
              <div className="space-y-4">
                {activeRole.outcomes.map((outcome) => (
                  <div key={outcome} className="flex items-start gap-3 rounded-2xl bg-surface-container/40 p-4">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-6">{outcome}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Workflow Promise</div>
                <p className="text-sm text-foreground leading-6">
                  Every task follows the same accountable path: Pending, Send for Approval, Completed, with structured
                  rework whenever work needs correction.
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
