'use client';

import Link from 'next/link';
import { LogoIcon } from '@/components/layout/Logo';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '#security' },
    { label: 'Workflow', href: '#product' },
    { label: 'Solutions', href: '#solutions' },
  ],
  Access: [
    { label: 'Company Login', href: '/company/login' },
    { label: 'Platform Login', href: '/platform/login' },
    { label: 'Start Free Trial', href: '/company/login' },
    { label: 'Request Demo', href: '#pricing' },
  ],
  Resources: [
    { label: 'Role-Based Experience', href: '#solutions' },
    { label: 'Core Modules', href: '#features' },
    { label: 'Security Overview', href: '#security' },
    { label: 'Pricing Plans', href: '#pricing' },
  ],
  Explore: [
    { label: 'Workflow Demo', href: '#product' },
    { label: 'Customer Proof', href: '#proof' },
    { label: 'Free Trial', href: '/company/login' },
  ],
};

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <LogoIcon className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">TaskEasy</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              The intelligent work operating system for modern teams.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-foreground text-sm mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} TaskEasy. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/company/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Company Login
            </Link>
            <Link href="/platform/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Platform Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
