// Small marks shown only to the person they're about:
//   "mine"  a chef's hat: their own "Make it mine" version of a recipe
//   "saved" a heart: a recipe in their cookbook
// Recipes get `marks` from present() in lib/recipe-ai.js. Other people never see someone else's marks.
const MARKS = {
  mine: {
    label: "Your \"Make it mine\" version",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 18h10v2.2a.8.8 0 0 1-.8.8H7.8a.8.8 0 0 1-.8-.8V18Z" />
        <path d="M6.6 16.5 6 11.3A4 4 0 0 1 8.4 4a4.2 4.2 0 0 1 7.2 0A4 4 0 0 1 18 11.3l-.6 5.2H6.6Z" />
      </svg>
    ),
  },
  saved: {
    label: "In your cookbook",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />
      </svg>
    ),
  },
};

export default function RecipeMarks({ marks }) {
  const shown = (marks ?? []).filter((m) => MARKS[m]);
  if (!shown.length) return null;
  return (
    <span className="recipe-marks">
      {shown.map((m) => (
        <span key={m} className={`recipe-mark ${m}`} title={MARKS[m].label} role="img" aria-label={MARKS[m].label}>
          {MARKS[m].icon}
        </span>
      ))}
    </span>
  );
}
