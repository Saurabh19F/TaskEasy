'use client';

import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 to-white -z-10" />

      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 mb-6">
              <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wide">New: Smart Workflows 2.0</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-5">
              Master your ops,<br />
              one task at a time.
            </h1>

            <p className="text-lg text-gray-500 mb-8 max-w-md">
              TaskEasy is the work operating system designed to help you bring tasks, delegations, and accountability into one place.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                href="/company/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
              >
                Get Started for Free
              </Link>
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Play className="h-4 w-4" fill="currentColor" />
                Watch Demo
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white" />
                <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white" />
              </div>
              <p className="text-sm text-gray-500">
                Joined by <span className="font-semibold text-gray-900">12,000+</span> professionals this month.
              </p>
            </div>
          </div>

          {/* Right - Dashboard preview */}
          <div className="relative">
            <div className="rounded-xl border border-gray-200 bg-white shadow-2xl shadow-blue-500/10 overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded bg-gray-100 flex items-center px-3">
                    <span className="text-xs text-gray-400">app.taskeasy.com</span>
                  </div>
                </div>
              </div>
              {/* Dashboard content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Welcome back, Alex!</p>
                    <p className="text-xs text-gray-400">Dashboard</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Task Progress Overview</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-2xl font-bold text-[#2563EB]">48</p>
                    <p className="text-xs text-gray-500">Active Tasks</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-2xl font-bold text-green-600">62%</p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-2xl font-bold text-orange-500">5</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>

                {/* Task list */}
                <div className="space-y-3">
                  {[
                    { name: 'Design Review', dept: 'Design', status: 'In Progress', color: 'blue' },
                    { name: 'Budget Approval', dept: 'Finance', status: 'Pending', color: 'orange' },
                    { name: 'Deployment', dept: 'Engineering', status: 'Completed', color: 'green' },
                  ].map((task) => (
                    <div key={task.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.name}</p>
                        <p className="text-xs text-gray-400">{task.dept}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        task.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                        task.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
