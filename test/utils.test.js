import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInterval, getRandomBetween, isAbortError, sleep } from "../src/utils.js";

await describe("formatInterval", async () => {
  await it("formats zero and negative values as 0 seconds", () => {
    assert.equal(formatInterval(0), "0 seconds");
    assert.equal(formatInterval(-500), "0 seconds");
  });

  await it("rounds sub-second positive durations up for natural countdowns", () => {
    assert.equal(formatInterval(200), "1 second");
    assert.equal(formatInterval(1_000), "1 second");
    assert.equal(formatInterval(2_000), "2 seconds");
  });

  await it("formats minutes and hours with proper pluralization", () => {
    assert.equal(formatInterval(60_000), "1 minute 0 seconds");
    assert.equal(formatInterval(61_000), "1 minute 1 second");
    assert.equal(formatInterval(125_000), "2 minutes 5 seconds");
    assert.equal(formatInterval(3_660_000), "1 hour 1 minute");
    assert.equal(formatInterval(7_320_000), "2 hours 2 minutes");
  });
});

await describe("getRandomBetween", async () => {
  await it("returns values within the inclusive range", () => {
    for (let i = 0; i < 50; i++) {
      const value = getRandomBetween(10, 20);
      assert.ok(value >= 10 && value <= 20);
    }
  });

  await it("handles equal and reversed bounds", () => {
    assert.equal(getRandomBetween(7, 7), 7);
    const reversed = getRandomBetween(20, 10);
    assert.ok(reversed >= 10 && reversed <= 20);
  });
});

await describe("sleep", async () => {
  await it("waits without terminal output when stream is not a TTY", async () => {
    /** @type {string[]} */
    const chunks = [];
    const mockStream = {
      isTTY: false,
      write(/** @type {string} */ chunk) {
        chunks.push(chunk);
        return true;
      },
    };

    await sleep(25, { stream: mockStream });
    assert.equal(chunks.length, 0);
  });

  await it("clears the line using ANSI erase sequences on interactive TTY streams", async () => {
    /** @type {string[]} */
    const chunks = [];
    const mockStream = {
      isTTY: true,
      write(/** @type {string} */ chunk) {
        chunks.push(chunk);
        return true;
      },
    };

    await sleep(30, { stream: mockStream, label: "Testing" });
    assert.ok(chunks.some((chunk) => chunk.includes("Testing:") && chunk.endsWith("\x1B[K")));
    assert.equal(chunks.at(-1), "\r\x1B[2K");
  });

  await it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () => sleep(5_000, { signal: controller.signal, silent: true }),
      (error) => isAbortError(error)
    );
  });

  await it("aborts an in-flight sleep promptly", async () => {
    const controller = new AbortController();
    const start = Date.now();
    setTimeout(() => controller.abort(), 25);

    await assert.rejects(
      () => sleep(5_000, { signal: controller.signal, silent: true }),
      (error) => isAbortError(error)
    );

    assert.ok(Date.now() - start < 1_000);
  });
});
