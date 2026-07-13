'use client';

import { motion } from 'framer-motion';
import {
  ClipboardList, Users, Calendar, FileText, BarChart3, Shield,
  Bell, Settings, Briefcase, Workflow, CheckSquare, Globe,
} from 'lucide-react';

const modules = [
  { icon: ClipboardList, title: 'Task Management', desc: 'Create, assign, and track tasks with priorities, deadlines, and status workflows.' },
  { icon: Users, title: 'Team Collaboration', desc: 'Real-time collaboration with comments, mentions, and shared workspaces.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'Automate repetitive processes with custom triggers and actions.' },
  { icon: Calendar, title: 'Calendar & Scheduling', desc: 'Integrated calendar with drag-and-drop scheduling and reminders.' },
  { icon: FileText, title: 'Document Management', desc: 'Centralized file storage with version control and access permissions.' },
  { icon: BarChart3, title: 'Analytics & Reports', desc: 'Real-time dashboards with actionable insights and exportable reports.' },
  { icon: CheckSquare, title: 'Checklists & SOPs', desc: 'Standardize operations with reusable checklists and procedures.' },
  { icon: Bell, title: 'Smart Notifications', desc: 'Context-aware alerts via email, in-app, and mobile push notifications.' },
  { icon: Shield, title: 'Security & Compliance', desc: 'Enterprise-grade security with 2FA, audit logs, and role-based access.' },
  { icon: Briefcase, title: 'Project Portfolios', desc: 'Bird\'s-eye view of all projects with health scores and milestones.' },
  { icon: Settings, title: 'Custom Configurations', desc: 'Tailor modules, fields, and workflows to match your organization.' },
  { icon: Globe, title: 'Multi-Tenant Platform', desc: 'Isolated workspaces for each company with centralized platform control.' },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
            Core Modules
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to run operations
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            12 integrated modules that cover every aspect of work management — from task creation to executive reporting.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod, idx) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="group p-6 rounded-xl border border-border bg-surface hover:border-primary/30 hover:shadow-md transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <mod.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{mod.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
