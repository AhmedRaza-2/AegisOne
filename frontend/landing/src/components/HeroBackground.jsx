export default function HeroBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#F8FAFC] md:bg-[#FAFAFA]"
      aria-hidden="true"
    >
      {/* ── 1. PREMIUM AURORA GRADIENT MESH ── */}
      {/* Replacing heavy CSS blur loops with efficient animated blobs */}
      <div className="absolute inset-0 opacity-80 hidden md:block">
        <div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full animate-blob"
          style={{ background: 'radial-gradient(circle, rgba(147, 197, 253, 0.25) 0%, transparent 70%)' }} 
        />
        <div 
          className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full animate-blob animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(165, 180, 252, 0.25) 0%, transparent 70%)' }} 
        />
        <div 
          className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full animate-blob animation-delay-4000"
          style={{ background: 'radial-gradient(circle, rgba(103, 232, 249, 0.25) 0%, transparent 70%)' }} 
        />
      </div>

      {/* ── 2. SUBTLE DOT MESH PATTERN ── */}
      <div 
        className="absolute inset-0 opacity-[0.10] md:opacity-[0.25]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(10, 25, 49, 0.4) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
        }}
      />

      {/* ── 3. MOUSE SPOTLIGHT (moved via transform so it never repaints) ── */}
      {/* ── 4. HORIZON FADE ── */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#F8FAFC] md:from-[#FAFAFA] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/90 md:from-[#FAFAFA] md:via-[#FAFAFA]/80 to-transparent pointer-events-none" />
    </div>
  );
}
