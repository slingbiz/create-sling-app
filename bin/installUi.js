const colors = require("colors");

const FRAMES = [
  "● ● ○ ○ ○",
  "○ ● ● ○ ○",
  "○ ○ ● ● ○",
  "○ ○ ○ ● ●",
  "○ ○ ○ ○ ●",
  "○ ○ ○ ● ●",
  "○ ○ ● ● ○",
  "○ ● ● ○ ○",
];

const printBanner = () => {
  console.log("");
  console.log(colors.bold.yellow("  sling.biz"));
  console.log(colors.gray("  Sling CMS"));
  console.log("");
};

const startProgress = () => {
  let frame = 0;
  let hint = "Starting…";
  let drawn = false;
  let timer = null;

  const clearBlock = () => {
    if (!drawn) {
      return;
    }
    process.stdout.write("\x1b[1A\r\x1b[2K\x1b[1A\r\x1b[2K");
  };

  const render = () => {
    const dots = FRAMES[frame % FRAMES.length];
    clearBlock();
    process.stdout.write(`  ${colors.yellow(dots)}   ${colors.bold("sling.biz")}\n`);
    process.stdout.write(`  ${colors.white(hint)}\n`);
    drawn = true;
  };

  if (process.stdout.isTTY) {
    timer = setInterval(() => {
      frame += 1;
      render();
    }, 140);
  }

  return {
    hint(next) {
      hint = next;
      render();
    },
    succeed(text) {
      if (timer) {
        clearInterval(timer);
      }
      clearBlock();
      drawn = false;
      console.log(`  ${colors.green("✓")}  ${text}`);
      console.log("");
    },
    fail(text) {
      if (timer) {
        clearInterval(timer);
      }
      clearBlock();
      drawn = false;
      console.log(`  ${colors.red("✗")}  ${text}`);
      console.log("");
    },
  };
};

const printRunningNextSteps = ({ geminiMissing } = {}) => {
  console.log(colors.bold.yellow("  sling.biz"));
  console.log("");
  console.log(
    `  1. Sign up at ${colors.underline.blue("http://localhost:2021")}`
  );
  console.log("     Create an account and get going.");
  console.log("");
  console.log(
    `  2. API at ${colors.underline.blue("http://localhost:10001")}`
  );
  console.log("     Studio and the storefront talk to this.");
  console.log("");
  console.log(
    `  3. Preview Studio changes at ${colors.underline.blue(
      "http://localhost:4087"
    )}`
  );
  console.log("     The live site is the storefront.");
  console.log("");
  if (geminiMissing) {
    console.log(
      colors.yellow(
        "  No Gemini key yet. Add GEMINI_API_KEY to sling-api/.env before Create will generate."
      )
    );
    console.log("");
  }
  console.log(colors.gray("  Ctrl + C stops all three."));
  console.log("");
};

const printHostedNextSteps = ({ keysMissing } = {}) => {
  console.log(colors.bold.yellow("  sling.biz"));
  console.log("");
  console.log(
    `  1. Sign up at ${colors.underline.blue("https://studio.sling.biz")}`
  );
  console.log("     Create an account and a company.");
  console.log("");
  console.log(
    `  2. Create pages at ${colors.underline.blue(
      "https://studio.sling.biz/create"
    )}`
  );
  console.log("     Hosted Create is 20 pages a day.");
  console.log("");
  console.log(
    `  3. Preview the live site at ${colors.underline.blue(
      "http://localhost:4087"
    )}`
  );
  console.log("     This storefront talks to hosted Studio.");
  console.log("");
  if (keysMissing) {
    console.log(
      colors.yellow(
        "  No company keys yet. After signup, paste them from Settings → Keys into sling-fe/.env and restart."
      )
    );
    console.log("");
  }
  console.log(colors.gray("  Ctrl + C stops the storefront."));
  console.log("");
};

module.exports = {
  printBanner,
  startProgress,
  printRunningNextSteps,
  printHostedNextSteps,
};
