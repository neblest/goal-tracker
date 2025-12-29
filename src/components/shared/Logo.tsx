/**
 * Reusable Logo component
 * Displays the Aimbition logo with target icon, clickable to return to home page
 */
export function Logo() {
  return (
    <a
      href="/"
      className="flex items-center justify-center gap-2 group hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]/30 rounded"
      aria-label="Powrót do strony głównej"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D4A574"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
      <span className="text-xl font-bold bg-gradient-to-r from-[#D4A574] to-[#C9965E] text-transparent bg-clip-text">
        Aimbition
      </span>
    </a>
  );
}
