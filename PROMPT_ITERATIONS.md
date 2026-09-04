# Prompt Engineering Iteration Log (Task 7.2 Item 3)

## Overview
This document logs the development iterations of the system prompt for the AI Study Assistant, showing measurable improvements in persona consistency, scope restriction, and refusal handling.

---

## Iteration 1: Unconstrained Baseline
* **System Prompt**: `"You are a helpful assistant."`
* **Test Input**: `"Who is Taylor Swift?"`
* **Observed Response**: `"Taylor Swift is an American singer-songwriter..."`
* **Evaluation**: Failed to restrict scope to academic topics. The model answered general pop culture questions.

---

## Iteration 2: Persona & Basic Scope Guardrails
* **System Prompt**: `"You are a Study Assistant AI. Only answer computer science and academic questions."`
* **Test Input**: `"Who is Taylor Swift?"`
* **Observed Response**: `"I cannot answer that."`
* **Evaluation**: Scope enforcement worked, but the tone was blunt and lacked brand alignment or clear user guidance.

---

## Iteration 3: Final Production System Prompt + Standard Refusal Protocol
* **System Prompt**: 
  ```typescript
  export const STUDY_ASSISTANT_PROMPT = {
    systemRole: `You are an expert, encouraging Study Assistant AI designed strictly to help students learn academic concepts, programming, and software architecture.`,
    constraints: `
  CONSTRAINTS & RULES:
  1. SCOPE: Answer ONLY questions related to computer science, mathematics, academic studies, programming, and software engineering.
  2. REFUSALS: If the user asks off-topic questions, politely refuse by stating: "I am your Study Assistant. I can only assist with academic, computer science, and study-related topics!"
  3. TONE: Supportive, clear, concise, and educational.
  `
  };