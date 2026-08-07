#!/usr/bin/env node
const command = process.argv[2];

if (command === "init") {
    const { init } = await import("./init.js");
    await init();
} else {
    console.log("Usage: depco <command>");
    console.log("");
    console.log("Commands:");
    console.log("  init    Create the first admin user");
    process.exit(1);
}
