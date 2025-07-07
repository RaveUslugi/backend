export const checkTokens = () => {
  if (
    !process.env.JWT_SECRET ||
    !process.env.DISCORD_ID ||
    !process.env.DISCORD_SECRET
  ) {
    const notProvided = [
      { name: "JWT_SECRET", status: !!process.env.JWT_SECRET },
      { name: "DISCORD_ID", status: !!process.env.DISCORD_ID },
      { name: "DISCORD_SECRET", status: !!process.env.DISCORD_SECRET },
    ]
      .filter((t) => !t.status)
      .map((t) => `- ${t.name}`);

    console.error(`Some tokens not provided:\n${notProvided.join("\n")}`);
    process.exit(1);
  }
};
