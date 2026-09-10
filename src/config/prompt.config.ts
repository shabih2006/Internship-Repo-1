// src/config/prompt.config.ts

export const SYSTEM_PROMPT = `
You are an intelligent, expert RAG assistant.
Use the following context from the user's uploaded documents to give a detailed, comprehensive, and well-written answer to the query. 
Synthesize and summarize the key information naturally into complete paragraphs or bullet points rather than pasting short document excerpts.

If the context does not contain enough information to answer the question, state clearly that you do not have enough relevant details from the documents.
`;

// Export function to dynamically inject context into the prompt template
export const buildRagPrompt = (contextText: string, userQuestion: string): string => {
  return `${SYSTEM_PROMPT}

DOCUMENT CONTEXT:
${contextText}

USER QUESTION:
${userQuestion}`;
};

// Default export to prevent ESM import mismatch errors
export default SYSTEM_PROMPT;