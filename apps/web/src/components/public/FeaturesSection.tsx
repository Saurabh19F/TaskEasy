'use client';

import { CheckSquare, Target, RefreshCw, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: CheckSquare,
    title: 'Smart Prioritization',
    description: 'Intelligently rank tasks based on deadlines and importance using our proprietary algorithm.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Target,
    title: 'Focus Mode',
    description: 'A distraction-free environment for deep work sessions with integrated ambient sounds.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: RefreshCw,
    title: 'Seamless Sync',
    description: 'Access your tasks across all your devices instantly with offline support and cloud backup.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: BarChart3,
    title: 'Progress Analytics',
    description: 'Visualize your productivity trends with elegant charts and weekly performance reports.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything you need, nothing you don&apos;t.
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            Focus on your work, not on managing your tools. Our features are built for maximum cognitive clarity.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-gray-100 transition-shadow"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${f.bg} mb-4`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
