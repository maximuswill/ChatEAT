// Turns the compact recipe format used in the library files into the full recipe shape
// the app shows (the same shape AI recipes use).
//
// Compact format:
//   id, title, style, summary, time: [total, handsOn], difficulty, servings,
//   ing: [[amount, item], ...], steps, tips, skill, nutr: [calories, protein],
//   course: main | side | breakfast | snack | dessert | baking
//   meal: ["breakfast", "lunch", "dinner", "snack", "dessert"]
//   cuisine, protein, equip: tools needed ("Oven|Air fryer" means either works),
//   tags: words people might use (hearty, quick, budget, high-protein, ...),
//   pairs: ids of sides or mains that go well with it, source: { name, url } when checked against one

export function r(o) {
  return {
    id: o.id,
    title: o.title,
    style: o.style,
    summary: o.summary,
    total_minutes: o.time[0],
    active_minutes: o.time[1],
    difficulty: o.difficulty,
    servings: o.servings,
    // A row with an empty item or amount and a trailing colon is a section heading, like "For the sauce:".
    ingredients: o.ing.map(([amount, item]) => {
      if (item === "") return { item: amount, amount: "", heading: true };
      if (amount === "" && item.endsWith(":")) return { item, amount: "", heading: true };
      return { item, amount };
    }),
    steps: o.steps,
    tips: o.tips ?? [],
    new_skill: o.skill ?? "",
    nutrition: { calories: o.nutr[0], protein_g: o.nutr[1] },
    course: o.course,
    meal: o.meal ?? [],
    cuisine: o.cuisine ?? "",
    protein: o.protein ?? "",
    equip: o.equip ?? [],
    tags: o.tags ?? [],
    pairs: o.pairs ?? [],
    source: o.source ?? null,
  };
}
