/*
  ============================================================
  EDIT YOUR HOMEPAGE TEXT HERE
  ============================================================
  Every word on the homepage comes from this file.

  How to change text:
    - Change the words between the two backticks ` `
    - Apostrophes and quotation marks inside the backticks are fine.
    - Leave the backticks and the commas at the ends of lines alone.

  How to add or remove an item in a list:
    - Each item is one { ... }, block. Copy one to add an item,
      or delete the whole block to remove it. The page adjusts itself.

  To hide a small line of text, leave its backticks empty: ``
  Save the file, then refresh the page to see your change.

  Colors live in app/globals.css.
*/

const CONTENT = {

  brand: `ChatEAT`,

  /* ---------- BUTTONS IN THE TOP BAR ---------- */
  account: {
    loginButton: `Log in`,
    signupButton: `Sign up`,
  },

  /* ---------- TOP OF THE PAGE ---------- */
  hero: {
    badge: `In development`,
    headline: `Never wonder what to cook again.`,
    intro: `ChatEAT is an AI cooking coach that learns your tastes, your schedule and your goals. It plans your week, tells you what to make right now, and helps you become a better cook along the way.`,
    primaryButton: `See what it does`,
    secondaryButton: `See the price`,
  },

  /* ---------- SAMPLE WEEK SHOWN AT THE TOP ----------
     "pinned: true" highlights a meal planned for a specific reason.
     "pinned: false" shows an open slot the user picks later. */
  sampleWeek: {
    label: `Sample week`,
    title: `Your week, planned around your life`,
    days: [
      { day: `Mon`, meal: `Dinner`,                 note: `Open: pick from this week's options`, pinned: false },
      { day: `Tue`, meal: `15-minute chicken wraps`, note: `Busy day, quick to make`,               pinned: true  },
      { day: `Wed`, meal: `Big-batch baked pasta`,   note: `Carbs before Thursday's game`,          pinned: true  },
      { day: `Thu`, meal: `Lunch`,                   note: `Open: pick from this week's options`,   pinned: false },
      { day: `Fri`, meal: `Homemade pizza night`,    note: `Friends are coming over`,               pinned: true  },
      { day: `Sat`, meal: `Grilled steak`,           note: `New skill: your first sear`,            pinned: true  },
      { day: `Sun`, meal: `Burrito bowl meal prep`,  note: `Lunches and snacks for the week`,       pinned: true  },
    ],
  },

  /* ---------- WHAT THE APP DOES ---------- */
  what: {
    label: `What it does`,
    headline: `A cooking coach that actually knows you.`,
    intro: `Tell ChatEAT what's going on in your life, in your own words. It turns that into food you'll want to eat and can actually make.`,
    items: [
      {
        title: `Plans your whole week`,
        text: `Say "I have a game Thursday and no time Monday." You get a calendar with meals set for the days that matter and a list of options for the rest, including lunches and snacks.`,
      },
      {
        title: `Answers "what should I make?"`,
        text: `Send a sentence or two about what you're craving, what you have and how long you've got. You get about three recipes that fit, without explaining yourself again.`,
      },
      {
        title: `Teaches you as you go`,
        text: `Recipes match what you can already do, then stretch you a little at a time. Choose guided steps when you're learning, or plain instructions when you're not.`,
      },
    ],
  },

  /* ---------- WHO IT'S FOR ---------- */
  who: {
    label: `Who it's for`,
    headline: `Anyone who has to eat and doesn't have time to figure it out.`,
    intro: `ChatEAT starts with how you actually live, then adapts to your schedule, your appetite and your skill level.`,
    items: [
      {
        title: `Busy students and athletes`,
        text: `You eat a lot, your schedule is packed, and you need filling meals that don't take all night.`,
      },
      {
        title: `People learning to cook`,
        text: `You've barely cooked before and don't know where to start. ChatEAT starts where you are.`,
      },
      {
        title: `Anyone with a food goal`,
        text: `Fuel your training, eat better or spend less, with no calorie counting required.`,
      },
      {
        title: `Cooks stuck in a rut`,
        text: `You can cook, but you keep making the same five meals. ChatEAT brings new ideas you'll like.`,
      },
    ],
  },

  /* ---------- WHY IT'S WORTH PAYING FOR ---------- */
  why: {
    label: `Why it's worth paying for`,
    headline: `It gets more useful every week you use it.`,
    intro: `A recipe site gives everyone the same results. ChatEAT builds on what it learns about you.`,
    items: [
      {
        title: `It remembers you`,
        text: `Your tastes, allergies, equipment and goals are always factored in, so you never have to repeat them.`,
      },
      {
        title: `It bends with your week`,
        text: `Plans change. Swap, skip or move a meal without starting over.`,
      },
      {
        title: `It saves you money`,
        text: `It plans around what you have and what you can afford, and turns leftovers into new meals.`,
      },
      {
        title: `You keep the skills`,
        text: `Every week you cook, you get a little better, and those skills stay with you for life.`,
      },
    ],
    priceLabel: `One simple plan`,
    price: `$5`,
    pricePeriod: `a month`,
    priceNote: `Less than one takeout meal, for a whole month of knowing what to cook.`,
  },

  /* ---------- BOTTOM OF THE PAGE ---------- */
  footer: {
    credit: `Built by Maximus Williams`,
    contactLabel: `Questions or feedback:`,
    contactEmail: `maximuswilliams340@gmail.com`,
  },
};

export default CONTENT;
