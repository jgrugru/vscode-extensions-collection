---
name: systematic-debugging
description: Root-cause-first debugging for bugs, failing tests and unexpected behavior. Use when something is broken and you are tempted to patch the symptom. Find out why it fails before changing any code.
---

# Systematic Debugging

## The rule

Do not change code to fix a bug until you can say, in one sentence, why it happens.

A patch that hides a symptom costs more later than the time it saves now. Explain the cause first, then fix the cause.

## Step 1: Understand the failure

Before editing anything:

1. Read the whole error, stack trace and log output. Do not skim.
2. Make it fail on demand. If you cannot reproduce it, you cannot prove a fix.
3. Check what changed recently: commits, dependencies, config, data.
4. Collect evidence: logs, inputs, state at the moment of failure.
5. Walk backward from where the error shows up to where the bad value or state first appeared. The line that crashes is rarely the line that is wrong.

## Step 2: Compare against something that works

1. Find similar code or a past version that behaves correctly.
2. Read both fully, then list every difference.
3. Note what the broken code depends on: inputs, environment, ordering, shared state.

## Step 3: Test one idea at a time

1. Write down one hypothesis: "It fails because X."
2. Predict what you will see if X is true.
3. Run the smallest experiment that checks it, changing one thing only.
4. Compare the result with the prediction. Wrong guess: form a new hypothesis. Do not stack changes.

## Step 4: Fix it

1. Write a test that fails because of this bug.
2. Make the smallest change that addresses the cause.
3. Confirm the new test passes, then run the whole suite.
4. If the fix does not work, undo it and go back to step 3. Do not pile a second fix on top.

If three fixes in a row fail, stop. The problem is probably in the design, not the line you keep editing. Summarize what you learned and talk it over before trying anything else.

## Warning thoughts

Pause if you catch yourself thinking:

- "I'll patch it now and look into it later."
- "This should work" with no reason why.
- "Let me just try something" with no hypothesis.
- "It works on my machine" with no explanation of the difference.
- "One more try" after several failures.

## Quick patterns

- **Failing test:** read the full failure, find which assertion broke, then check the setup, fixtures and mocks before blaming the code.
- **Runtime error:** capture the full trace, see which value is null or wrong, and follow it back to its source. Validate there.
- **Used to work:** use `git bisect` to find the commit that broke it, then work out which assumption that commit changed.
- **Only fails sometimes:** suspect race conditions, shared mutable state, async ordering or timing. Fix with real synchronization, not sleeps.

## Before you call it fixed

- [ ] You can explain why the bug happened.
- [ ] The hypothesis was tested, not assumed.
- [ ] The change targets the cause, not the symptom.
- [ ] A test reproduced the bug and now passes.
- [ ] The full suite passes.
- [ ] The change is small and focused.
