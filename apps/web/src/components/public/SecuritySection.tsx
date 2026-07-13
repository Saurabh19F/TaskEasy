'use client';

import { motion } from 'framer-motion';
import { Shield, Lock, Eye, FileCheck, Server, Key } from 'lucide-react';

const features = [
  { icon: Lock, title: 'End-to-End Encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256).' },
  { icon: Key, title: 'Two-Factor Authentication', desc: 'TOTP-based 2FA for all user accounts with backup codes.' },
  { icon: Eye, title: 'Audit Logging', desc: 'Complete audit trail of every action with IP tracking and timestamps.' },
  { icon: Shield, title: 'Role-Based Access', desc: 'Granular permissions with custom roles and department-level controls.' },
  { icon: Server, title: 'Data Isolation', desc: 'Multi-tenant architecture with strict data isolation per company.' },
  { icon: FileCheck, title: 'Compliance Ready', desc: 'Built for SOC 2, GDPR, and ISO 27001 compliance requirements.' },
];

export function SecuritySection() {
  return (
    <section id="security" className="py-24 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
              Enterprise Security
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Security that never sleeps
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Your data is protected by enterprise-grade security at every layer. We take compliance seriously so you can focus on your work.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f, idx) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground text-sm">{f.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: visual */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border bg-surface p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="relative space-y-4">
                {/* Mock security dashboard */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container/50 border border-border">
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-foreground">All Systems Operational</span>
                  <span className="ml-auto text-xs text-muted-foreground">99.9% uptime</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface-container/50 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Threats Blocked</div>
                    <div className="text-xl font-bold text-foreground">2,847</div>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container/50 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Active Sessions</div>
                    <div className="text-xl font-bold text-foreground">1,203</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {['Encryption', 'Access Control', 'Monitoring'].map((item) => (
                    <div key={item} className="flex items-center gap-2 p-2 rounded bg-surface-container/30">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm text-foreground">{item}</span>
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
