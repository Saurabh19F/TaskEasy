'use client';

export function TestimonialsSection() {
  return (
    <section id="solutions" className="py-20 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        <span className="text-6xl font-serif text-[#2563EB]/20 leading-none block mb-6">&ldquo;</span>

        <blockquote className="text-xl md:text-2xl font-semibold text-gray-900 leading-relaxed mb-8">
          &ldquo;The only app that actually helps me stay focused instead of just managing a list. It&apos;s transformed how I approach my deep work.&rdquo;
        </blockquote>

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-300" />
          <div>
            <p className="font-semibold text-gray-900">Sarah J.</p>
            <p className="text-sm text-gray-500">Senior Product Designer @ DesignCo</p>
          </div>
        </div>
      </div>
    </section>
  );
}
