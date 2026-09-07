# Prompt Engineering Iterations Log (Task 7.2 Item 3)

### Iteration 1: Naive Prompt
- **Prompt**: "You are a helpful assistant."
- **Result**: Generic answers, verbose text blocks, no domain constraints.

### Iteration 2: Domain-Scoped Prompt
- **Prompt**: "You are an AI study assistant for university students. Answer CS and math questions."
- **Result**: Better context, but off-topic queries were still being answered and formatting lacked scannability.

### Iteration 3: Constrained & Structured System Prompt (Final)
- **Prompt**: Includes Scope, Tone, Strict Refusal Guidelines, and Few-Shot Examples (see `src/config/prompt.config.ts`).
- **Result**: Clean structured responses using bolding and bullet points; off-topic/cheating requests are politely declined instantly.